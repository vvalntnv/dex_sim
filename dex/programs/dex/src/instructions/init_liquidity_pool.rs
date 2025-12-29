use crate::constants::LIQUIDITY_POOL_SEED;
use crate::errors::DEXError;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
    token_interface::{Mint, TokenAccount},
};

use crate::state::Pool;

pub fn initialize_liquidity_pool(
    ctx: Context<InitializeLiquidityPool>,
    initial_fee_bps: u64,
) -> Result<()> {
    // TODO: Make sure mint_a and mint_b LPs with changed places DO NOT exist
    require!(initial_fee_bps <= 10_000, DEXError::InvalidBPSValue);

    let liquidity_pool = &mut ctx.accounts.liquidity_pool;

    liquidity_pool.vault_a = ctx.accounts.vault_a.key();
    liquidity_pool.vault_b = ctx.accounts.vault_b.key();
    liquidity_pool.lp_mint = ctx.accounts.lp_mint.key();
    liquidity_pool.fee_bps = initial_fee_bps;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeLiquidityPool<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint_a: InterfaceAccount<'info, Mint>,
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = signer,
        space = Pool::MAX_SIZE,
        seeds = [LIQUIDITY_POOL_SEED, mint_a.key().as_ref(), mint_b.key().as_ref()],
        bump
    )]
    pub liquidity_pool: Account<'info, Pool>,

    #[account(
        init,
        payer = signer,
        mint::decimals = 9,
        mint::authority = liquidity_pool,
    )]
    pub lp_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = signer,
        associated_token::mint = mint_a,
        associated_token::authority = liquidity_pool,
    )]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = signer,
        associated_token::mint = mint_b,
        associated_token::authority = liquidity_pool,
    )]
    pub vault_b: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
