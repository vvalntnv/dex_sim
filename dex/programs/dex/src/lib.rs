mod constants;
mod errors;
mod instructions;
mod state;
mod utils;
use anchor_lang::prelude::*;

use instructions::*;

declare_id!("3Erst2Kv5xtrBemCEHekz2wbVEaGet7N3Z6s2eEt7Wjj");

#[program]
pub mod dex {
    use super::*;

    pub fn initialize(ctx: Context<InitializeLiquidityPool>, initial_fee_bps: u64) -> Result<()> {
        instructions::init_liquidity_pool::initialize_liquidity_pool(ctx, initial_fee_bps)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
