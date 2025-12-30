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

    pub fn add_liquidity_to_pool(
        ctx: Context<AddLiquidityToPool>,
        token_a_amount: u64,
        token_b_amount: u64,
    ) -> Result<()> {
        instructions::add_liquidity::add_liquidity_to_pool(ctx, token_a_amount, token_b_amount)
    }

    pub fn withdraw_liquidity_from_pool(
        ctx: Context<WithdrawLiquidityFromPool>,
        lp_tokens_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_liquidity::withdraw_liquidity_from_pool(ctx, lp_tokens_amount)
    }

    pub fn exchange_tokens(
        ctx: Context<ExchangeTokens>,
        amount_to_exchange: u64,
        min_receive_amount: u64,
    ) -> Result<()> {
        instructions::exchange_tokens::exchange_tokens(ctx, amount_to_exchange, min_receive_amount)
    }
}
