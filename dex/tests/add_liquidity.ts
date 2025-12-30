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

describe("add_liquidity", () => {
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

    // Mint tokens to user (enough for initial + subsequent tests)
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
  });

  it("Adds initial liquidity successfully", async () => {
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

    // Verify Vault Balances
    const vaultAAccount = await getAccount(provider.connection, vaultA);
    const vaultBAccount = await getAccount(provider.connection, vaultB);
    assert.equal(vaultAAccount.amount.toString(), amountA.toString());
    assert.equal(vaultBAccount.amount.toString(), amountB.toString());

    // Verify User LP Balance
    const userLpAccount = await getAccount(provider.connection, userLpToken);
    assert.isAbove(Number(userLpAccount.amount), 0);
  });

  it("Adds subsequent liquidity proportionally", async () => {
    // Existing: A=1000, B=2000. Ratio 1:2.
    // Add A=500, B=1000.
    const amountA = new anchor.BN(500_000_000);
    const amountB = new anchor.BN(1000_000_000);

    await program.methods
      .addLiquidityToPool(amountA, amountB)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    const vaultAAccount = await getAccount(provider.connection, vaultA);
    const vaultBAccount = await getAccount(provider.connection, vaultB);

    // Total A = 1500, Total B = 3000
    assert.equal(
      vaultAAccount.amount.toString(),
      (INITIAL_A_AMOUNT + 500_000_000).toString()
    );
    assert.equal(
      vaultBAccount.amount.toString(),
      (INITIAL_B_AMOUNT + 1000_000_000).toString()
    );
  });

  it("Scales up amounts when ratio is not preserved (and succeeds if user has funds)", async () => {
    // Current: A=1500, B=3000. Ratio 1:2.
    // Try adding A=100, B=100.
    // Logic:
    // prop_b = 100 * 3000 / 1500 = 200.
    // 200 >= 100. Else branch.
    // B_final = 200.
    // So it takes 100 A and 200 B.

    const amountA = new anchor.BN(100_000_000);
    const amountB = new anchor.BN(100_000_000);

    const preUserA = await getAccount(provider.connection, userTokenA);
    const preUserB = await getAccount(provider.connection, userTokenB);

    await program.methods
      .addLiquidityToPool(amountA, amountB)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .rpc();

    const postUserA = await getAccount(provider.connection, userTokenA);
    const postUserB = await getAccount(provider.connection, userTokenB);

    // Check that 100 A was taken
    const diffA =
      BigInt(preUserA.amount.toString()) - BigInt(postUserA.amount.toString());
    assert.equal(diffA.toString(), "100000000");

    // Check that 200 B was taken (scaled up)
    const diffB =
      BigInt(preUserB.amount.toString()) - BigInt(postUserB.amount.toString());
    assert.equal(diffB.toString(), "200000000");
  });
});
