use anchor_lang::prelude::*;
use anchor_spl::token::{burn, transfer, Burn, Token, Transfer};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::constants::{LIQUIDITY_POOL_SEED, MINIMUM_LIQUIDITY_WITHDRAWAL};
use crate::errors::DEXError;
use crate::state::Pool;
use crate::utils::{calculate_withdrawal_amounts, get_pool_signer_seeds};

pub fn withdraw_liquidity_from_pool(
    ctx: Context<WithdrawLiquidityFromPool>,
    lp_tokens_amount: u64,
) -> Result<()> {
    require!(
        lp_tokens_amount >= MINIMUM_LIQUIDITY_WITHDRAWAL,
        DEXError::WithdrawalTooSmall
    );

    let total_lp_supply = ctx.accounts.lp_mint.supply;
    let vault_a_amount = ctx.accounts.vault_a.amount;
    let vault_b_amount = ctx.accounts.vault_b.amount;

    require!(total_lp_supply > 0, DEXError::EmptyPool);

    let (amount_a, amount_b) = calculate_withdrawal_amounts(
        lp_tokens_amount,
        total_lp_supply,
        vault_a_amount,
        vault_b_amount,
    )?;

    require!(amount_a > 0 && amount_b > 0, DEXError::WithdrawalTooSmall);

    let mint_a_key = ctx.accounts.mint_a.key();
    let mint_b_key = ctx.accounts.mint_b.key();

    let signer_seeds = get_pool_signer_seeds(&mint_a_key, &mint_b_key, &ctx.bumps.liquidity_pool);
    let signer_seeds_slice: &[&[&[u8]]] = &[&signer_seeds];

    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.lp_mint.to_account_info(),
                from: ctx.accounts.user_lp_tokens_account.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            },
        ),
        lp_tokens_amount,
    )?;

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_a.to_account_info(),
                to: ctx.accounts.user_token_a_account.to_account_info(),
                authority: ctx.accounts.liquidity_pool.to_account_info(),
            },
            signer_seeds_slice,
        ),
        amount_a,
    )?;

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_b.to_account_info(),
                to: ctx.accounts.user_token_b_account.to_account_info(),
                authority: ctx.accounts.liquidity_pool.to_account_info(),
            },
            signer_seeds_slice,
        ),
        amount_b,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawLiquidityFromPool<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        constraint = mint_a.key() < mint_b.key() @ DEXError::InvalidMintOrdering
    )]
    pub mint_a: InterfaceAccount<'info, Mint>,
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [LIQUIDITY_POOL_SEED, mint_a.key().as_ref(), mint_b.key().as_ref()],
        bump,
        has_one = vault_a,
        has_one = vault_b,
        has_one = mint_a,
        has_one = mint_b
    )]
    pub liquidity_pool: Account<'info, Pool>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = liquidity_pool
    )]
    pub vault_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = liquidity_pool
    )]
    pub vault_b: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        mint::authority = liquidity_pool,
    )]
    pub lp_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = lp_mint,
        associated_token::authority = signer
    )]
    pub user_lp_tokens_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_a,
        associated_token::authority = signer
    )]
    pub user_token_a_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_b,
        associated_token::authority = signer
    )]
    pub user_token_b_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
