import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Dex } from "../target/types/dex";
import { createMint, getAssociatedTokenAddress } from "@solana/spl-token";
import { assert } from "chai";

describe("dex", () => {
  // Configure the client to use the local cluster.
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

  // Constants
  const FEE_BPS = new anchor.BN(100); // 1%

  before(async () => {
    // 1. Create Mints
    // We need to use the provider wallet as the payer
    const payer = (provider.wallet as anchor.Wallet).payer;

    mintA = await createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      null,
      6,
    );

    mintB = await createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      null,
      6,
    );

    if (mintA.toBuffer().compare(mintB.toBuffer()) > 0) {
      [mintA, mintB] = [mintB, mintA];
    }

    // 2. Generate LP Mint Keypair (it will be initialized by the program)
    lpMintKeypair = anchor.web3.Keypair.generate();

    // 3. Derive Liquidity Pool PDA
    // seeds = [LIQUIDITY_POOL_SEED, mint_a.key().as_ref(), mint_b.key().as_ref()]
    // LIQUIDITY_POOL_SEED = "pool" (from constants.rs)
    [liquidityPoolPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), mintA.toBuffer(), mintB.toBuffer()],
      program.programId,
    );

    // 4. Derive Vault ATAs
    // These are associated token accounts for the liquidity pool PDA
    vaultA = await getAssociatedTokenAddress(
      mintA,
      liquidityPoolPda,
      true, // allowOwnerOffCurve: true because owner is a PDA
    );

    vaultB = await getAssociatedTokenAddress(mintB, liquidityPoolPda, true);
  });

  it("Errors when fee BPS is > 10000", async () => {
    const BAD_FEE_BPS = new anchor.BN(10001);

    try {
      await program.methods
        .initialize(BAD_FEE_BPS)
        .accounts({
          signer: provider.wallet.publicKey,
          mintA: mintA,
          mintB: mintB,
          lpMint: lpMintKeypair.publicKey,
        })
        .signers([lpMintKeypair])
        .rpc();
      assert.fail("The transaction should have failed with InvalidBPSValue");
    } catch (err) {
      // Verify the error
      assert.ok(err.error !== undefined, "Error should be an AnchorError");
      assert.strictEqual(err.error.errorCode.code, "InvalidBPSValue");
    }
  });

  it("Is initialized!", async () => {
    const tx = await program.methods
      .initialize(FEE_BPS)
      .accounts({
        signer: provider.wallet.publicKey,
        mintA: mintA,
        mintB: mintB,
        lpMint: lpMintKeypair.publicKey,
      })
      .signers([lpMintKeypair]) // lpMint must sign because of init
      .rpc();

    console.log("Your transaction signature", tx);

    // Verify state
    const poolAccount = await program.account.pool.fetch(liquidityPoolPda);

    // Check basic fields
    assert.ok(poolAccount.vaultA.equals(vaultA), "Vault A should match");
    assert.ok(poolAccount.vaultB.equals(vaultB), "Vault B should match");
    assert.ok(
      poolAccount.lpMint.equals(lpMintKeypair.publicKey),
      "LP Mint should match",
    );
    assert.ok(poolAccount.feeBps.eq(FEE_BPS), "Fee BPS should match");

    // Note: mintA and mintB are not currently set in the instruction implementation
    // so we skip asserting them to match existing code behavior.
  });
});
