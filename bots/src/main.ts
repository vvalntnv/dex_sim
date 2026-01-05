import { Connection, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { AggressiveBot } from "./impl/AggressiveBot";
import { ParanoidBot } from "./impl/ParanoidBot";
import { NewsOracle } from "./market/NewsOracle";
import * as setup from "./utils/setup";

async function main() {
  console.log("Starting DEX Bot Simulation...");

  // 1. Connect to Localhost
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const payer = Keypair.generate(); // In real sim, load from file or env
  
  // TODO: Load the program
  // const provider = new AnchorProvider(connection, new Wallet(payer), {});
  // const program = ...

  // 2. Setup Market (Mints, Pools)
  // const marketState = await setup.setupMarket(connection, payer, program);

  // 3. Initialize Bots
  const bots = [
    // new AggressiveBot(connection, program),
    // new ParanoidBot(connection, program),
  ];

  // 4. Initialize News Oracle
  const oracle = new NewsOracle();
  bots.forEach(bot => oracle.subscribe(bot.onNews.bind(bot)));

  // 5. Simulation Loop
  let running = true;
  while (running) {
    console.log("--- Tick ---");
    
    // Bots make decisions
    // await Promise.all(bots.map(bot => bot.onTick()));

    // Random News Event
    if (Math.random() > 0.8) {
        const news = oracle.generateRandomNews();
        oracle.broadcast(news);
    }

    // Wait for next tick
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// main().catch(console.error);
