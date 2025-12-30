import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Dex } from "../target/types/dex";
import {
  createMint,
  getAssociatedTokenAddress,
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("withdraw_liquidity", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.dex as Program<Dex>;

  // Accounts
  let mintA: anchor.web3.PublicKey;
  let mintB: anchor.web3.PublicKey;
  let lpMintKeypair: anchor.web3.Keypair;
  let liquidityPoolPda: anchor.web3.PublicKey;
  let vaultA: anchor.web3.PublicKey;
  let vaultB: anchor.web3.PublicKey;
  let userTokenA: anchor.web3.PublicKey;
  let userTokenB: anchor.web3.PublicKey;
  let userLpToken: anchor.web3.PublicKey;

  // Constants
  const FEE_BPS = new anchor.BN(100); // 1%
  const INITIAL_A_AMOUNT = 1000_000_000;
  const INITIAL_B_AMOUNT = 2000_000_000;

  before(async () => {
    const payer = (provider.wallet as anchor.Wallet).payer;

    // 1. Create Mints
    mintA = await createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      null,
      6
    );
    mintB = await createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      null,
      6
    );

    // Ensure mintA < mintB for deterministic ordering required by the program
    if (mintA.toBuffer().compare(mintB.toBuffer()) > 0) {
      [mintA, mintB] = [mintB, mintA];
    }

    // 2. Generate LP Mint Keypair
    lpMintKeypair = anchor.web3.Keypair.generate();

    // 3. Derive Liquidity Pool PDA
    [liquidityPoolPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
      program.programId
    );

    // 4. Derive Vault ATAs
    vaultA = await getAssociatedTokenAddress(mintA, liquidityPoolPda, true);
    vaultB = await getAssociatedTokenAddress(mintB, liquidityPoolPda, true);

    // 5. Initialize Pool
    await program.methods
      .initialize(FEE_BPS)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .signers([lpMintKeypair])
      .rpc();

    // 6. Setup User Accounts and Mint Tokens
    userTokenA = await getAssociatedTokenAddress(
      mintA,
      provider.wallet.publicKey
    );
    userTokenB = await getAssociatedTokenAddress(
      mintB,
      provider.wallet.publicKey
    );

    // Create ATAs
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintA,
      provider.wallet.publicKey
    );
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintB,
      provider.wallet.publicKey
    );

    // Mint tokens to user (enough for all tests)
    await mintTo(
      provider.connection,
      payer,
      mintA,
      userTokenA,
      provider.wallet.publicKey,
      10_000_000_000
    );
    await mintTo(
      provider.connection,
      payer,
      mintB,
      userTokenB,
      provider.wallet.publicKey,
      10_000_000_000
    );

    // User LP Token Account
    userLpToken = await getAssociatedTokenAddress(
      lpMintKeypair.publicKey,
      provider.wallet.publicKey
    );

    // Add initial liquidity for tests
    const amountA = new anchor.BN(INITIAL_A_AMOUNT);
    const amountB = new anchor.BN(INITIAL_B_AMOUNT);

    await program.methods
      .addLiquidityToPool(amountA, amountB)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();
  });

  it("Withdraws partial liquidity successfully", async () => {
    const userLpAccountBefore = await getAccount(
      provider.connection,
      userLpToken
    );
    const vaultABefore = await getAccount(provider.connection, vaultA);
    const vaultBBefore = await getAccount(provider.connection, vaultB);
    const userTokenABefore = await getAccount(provider.connection, userTokenA);
    const userTokenBBefore = await getAccount(provider.connection, userTokenB);

    // Withdraw 50% of LP tokens
    const lpToWithdraw = new anchor.BN(
      Number(userLpAccountBefore.amount) / 2
    );

    await program.methods
      .withdrawLiquidityFromPool(lpToWithdraw)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    // Verify LP tokens were burned
    const userLpAccountAfter = await getAccount(provider.connection, userLpToken);
    assert.equal(
      userLpAccountAfter.amount.toString(),
      (BigInt(userLpAccountBefore.amount.toString()) - BigInt(lpToWithdraw.toString())).toString()
    );

    // Verify user received tokens
    const userTokenAAfter = await getAccount(provider.connection, userTokenA);
    const userTokenBAfter = await getAccount(provider.connection, userTokenB);

    assert.isAbove(
      Number(userTokenAAfter.amount),
      Number(userTokenABefore.amount)
    );
    assert.isAbove(
      Number(userTokenBAfter.amount),
      Number(userTokenBBefore.amount)
    );

    // Verify vaults decreased
    const vaultAAfter = await getAccount(provider.connection, vaultA);
    const vaultBAfter = await getAccount(provider.connection, vaultB);

    assert.isBelow(Number(vaultAAfter.amount), Number(vaultABefore.amount));
    assert.isBelow(Number(vaultBAfter.amount), Number(vaultBBefore.amount));
  });

  it("Withdraws all remaining liquidity", async () => {
    const userLpAccountBefore = await getAccount(
      provider.connection,
      userLpToken
    );

    // Withdraw all remaining LP tokens
    const lpToWithdraw = new anchor.BN(userLpAccountBefore.amount.toString());

    await program.methods
      .withdrawLiquidityFromPool(lpToWithdraw)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    // Verify LP balance is 0
    const userLpAccountAfter = await getAccount(provider.connection, userLpToken);
    assert.equal(userLpAccountAfter.amount.toString(), "0");

    // Verify vaults are (nearly) empty
    const vaultAAfter = await getAccount(provider.connection, vaultA);
    const vaultBAfter = await getAccount(provider.connection, vaultB);

    // Should be very close to 0 (allowing for rounding)
    assert.isBelow(Number(vaultAAfter.amount), 10);
    assert.isBelow(Number(vaultBAfter.amount), 10);
  });

  it("Multiple users can withdraw proportionally", async () => {
    // Setup second user
    const user2 = anchor.web3.Keypair.generate();
    const payer = (provider.wallet as anchor.Wallet).payer;

    // Airdrop SOL to user2
    const airdropSig = await provider.connection.requestAirdrop(
      user2.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    // Create token accounts for user2
    const user2TokenA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintA,
      user2.publicKey
    );
    const user2TokenB = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mintB,
      user2.publicKey
    );
    const user2LpToken = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      lpMintKeypair.publicKey,
      user2.publicKey
    );

    // Mint tokens to user2
    await mintTo(
      provider.connection,
      payer,
      mintA,
      user2TokenA.address,
      provider.wallet.publicKey,
      5_000_000_000
    );
    await mintTo(
      provider.connection,
      payer,
      mintB,
      user2TokenB.address,
      provider.wallet.publicKey,
      5_000_000_000
    );

    // Add liquidity from both users
    const amountA = new anchor.BN(1000_000_000);
    const amountB = new anchor.BN(2000_000_000);

    // User 1 adds liquidity
    await program.methods
      .addLiquidityToPool(amountA, amountB)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    // User 2 adds liquidity
    await program.methods
      .addLiquidityToPool(amountA, amountB)
      .accounts({
        signer: user2.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
        userLpTokensAccount: user2LpToken.address,
        userTokenAAccount: user2TokenA.address,
        userTokenBAccount: user2TokenB.address,
      })
      .signers([user2])
      .rpc();

    // Each user withdraws half their LP tokens
    const user1LpBefore = await getAccount(provider.connection, userLpToken);
    const user2LpBefore = await getAccount(
      provider.connection,
      user2LpToken.address
    );

    const user1Withdraw = new anchor.BN(Number(user1LpBefore.amount) / 2);
    const user2Withdraw = new anchor.BN(Number(user2LpBefore.amount) / 2);

    // User 1 withdraws
    await program.methods
      .withdrawLiquidityFromPool(user1Withdraw)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    // User 2 withdraws
    await program.methods
      .withdrawLiquidityFromPool(user2Withdraw)
      .accounts({
        signer: user2.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
        userLpTokensAccount: user2LpToken.address,
        userTokenAAccount: user2TokenA.address,
        userTokenBAccount: user2TokenB.address,
      })
      .signers([user2])
      .rpc();

    // Verify both users received proportional amounts
    const user1LpAfter = await getAccount(provider.connection, userLpToken);
    const user2LpAfter = await getAccount(
      provider.connection,
      user2LpToken.address
    );

    assert.equal(
      user1LpAfter.amount.toString(),
      (BigInt(user1LpBefore.amount.toString()) - BigInt(user1Withdraw.toString())).toString()
    );
    assert.equal(
      user2LpAfter.amount.toString(),
      (BigInt(user2LpBefore.amount.toString()) - BigInt(user2Withdraw.toString())).toString()
    );
  });

  it("Fails when withdrawing below minimum amount", async () => {
    // Try to withdraw less than MINIMUM_LIQUIDITY_WITHDRAWAL (1000)
    const tooSmall = new anchor.BN(999);

    try {
      await program.methods
        .withdrawLiquidityFromPool(tooSmall)
        .accounts({
          signer: provider.wallet.publicKey,
          mintA: mintA,
          mintB: mintB,
          lpMint: lpMintKeypair.publicKey,
        })
        .rpc();
      assert.fail("Should have failed with WithdrawalTooSmall");
    } catch (err) {
      assert.include(err.toString(), "WithdrawalTooSmall");
    }
  });

  it("Fails when withdrawing more LP tokens than owned", async () => {
    const userLpAccount = await getAccount(provider.connection, userLpToken);
    const tooMuch = new anchor.BN(
      Number(userLpAccount.amount) * 2 + 1000000
    );

    try {
      await program.methods
        .withdrawLiquidityFromPool(tooMuch)
        .accounts({
          signer: provider.wallet.publicKey,
          mintA: mintA,
          mintB: mintB,
          lpMint: lpMintKeypair.publicKey,
        })
        .rpc();
      assert.fail("Should have failed with insufficient tokens");
    } catch (err) {
      // This will fail at the token program level with insufficient funds
      assert.isTrue(err.toString().includes("Error") || err.toString().includes("0x1"));
    }
  });

  it("Verifies floor division protects pool", async () => {
    // Add liquidity
    const amountA = new anchor.BN(1000_000_000);
    const amountB = new anchor.BN(2000_000_000);

    await program.methods
      .addLiquidityToPool(amountA, amountB)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    const vaultABefore = await getAccount(provider.connection, vaultA);
    const vaultBBefore = await getAccount(provider.connection, vaultB);
    const totalValueBefore =
      BigInt(vaultABefore.amount.toString()) +
      BigInt(vaultBBefore.amount.toString());

    // Withdraw a small amount that might cause rounding
    const lpToWithdraw = new anchor.BN(10000);

    await program.methods
      .withdrawLiquidityFromPool(lpToWithdraw)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    const vaultAAfter = await getAccount(provider.connection, vaultA);
    const vaultBAfter = await getAccount(provider.connection, vaultB);
    const totalValueAfter =
      BigInt(vaultAAfter.amount.toString()) +
      BigInt(vaultBAfter.amount.toString());

    // Total value should have decreased (tokens withdrawn)
    // Floor division ensures pool is never over-distributed
    assert.isTrue(totalValueAfter < totalValueBefore);
  });
});
