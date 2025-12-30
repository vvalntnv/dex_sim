use anchor_lang::prelude::*;
use anchor_spl::{
    token::{transfer, Token, Transfer},
    token_interface::{Mint, TokenAccount},
};

use crate::{errors::DEXError, state::Pool, utils::get_pool_signer_seeds};

pub fn exchange_tokens(ctx: Context<ExchangeTokens>, amount_to_exchange: u64) -> Result<()> {
    let buyer = &ctx.accounts.buyer;
    let vault_from = &ctx.accounts.vault_from;
    let vault_to = &ctx.accounts.vault_to;
    let user_token_account_to = &ctx.accounts.buyer_token_account_to;
    let user_token_account_from = &ctx.accounts.buyer_token_account_from;
    let pool = &ctx.accounts.liquidity_pool;
    let token_program = &ctx.accounts.token_program;

    let price_constant = (vault_from.amount as u128)
        .checked_mul(vault_to.amount as u128)
        .ok_or(DEXError::MathOverflow)?;

    let new_vault_to_amount = (amount_to_exchange as u128)
        .checked_add(vault_to.amount as u128)
        .ok_or(DEXError::MathOverflow)?;

    let new_vault_from_amount = price_constant
        .checked_div(new_vault_to_amount)
        .ok_or(DEXError::MathOverflow)? as u64;

    let tokens_to_give = vault_from.amount - new_vault_from_amount;

    let signer_seeds = get_pool_signer_seeds(&pool.mint_a, &pool.mint_b, &pool.bump);
    let signer_seeds: &[&[&[u8]]] = &[&signer_seeds];

    transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: vault_from.to_account_info(),
                to: user_token_account_to.to_account_info(),
                authority: pool.to_account_info(),
            },
            &signer_seeds,
        ),
        amount_to_exchange,
    )?;

    transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: user_token_account_from.to_account_info(),
                to: vault_to.to_account_info(),
                authority: buyer.to_account_info(),
            },
        ),
        tokens_to_give,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct ExchangeTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    pub liquidity_pool: Account<'info, Pool>,

    #[account(mut)]
    pub mint_from: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = mint_from.key() != mint_to.key() @ DEXError::SameTokensExchanged
    )]
    pub mint_to: InterfaceAccount<'info, Mint>,

    #[account(
        associated_token::authority = buyer,
        associated_token::mint = mint_from,
    )]
    pub buyer_token_account_from: InterfaceAccount<'info, TokenAccount>,

    #[account(
        associated_token::authority = buyer,
        associated_token::mint = mint_to,
    )]
    pub buyer_token_account_to: InterfaceAccount<'info, TokenAccount>,

    // The logic for the vaults is reversed. The vault
    // that we are going to put money in is the opposite vault of the mint token
    // if we exchange from SOL to USDC, we want the target vault (vault_to) to be
    // equal to the FROM token (in this case Solana)
    #[account(
        mut,
        associated_token::mint = mint_from,
        associated_token::authority = liquidity_pool
    )]
    pub vault_to: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint_to,
        associated_token::authority = liquidity_pool
    )]
    pub vault_from: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
