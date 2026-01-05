import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";

export interface MarketState {
    mintA: PublicKey;
    mintB: PublicKey;
    poolPda: PublicKey;
}

export const setupMarket = async (
    connection: Connection, 
    payer: Keypair,
    program: Program<any>
): Promise<MarketState> => {
    console.log("Setting up market...");
    // TODO: 
    // 1. Create Mints
    // 2. Initialize Liquidity Pool via Program
    // 3. Fund initial liquidity
    
    return {
        mintA: PublicKey.default,
        mintB: PublicKey.default,
        poolPda: PublicKey.default
    };
}

export const airdropToBots = async (
    connection: Connection,
    payer: Keypair,
    bots: PublicKey[]
) => {
    // TODO: Fund bot wallets with SOL and SPL tokens
}
