use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{mint_to, transfer, MintTo, Token, Transfer};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::errors::DEXError;
use crate::{constants::LIQUIDITY_POOL_SEED, state::Pool, utils::{i_sqrt, get_pool_signer_seeds}};

pub fn add_liquidity_to_pool(
    ctx: Context<AddLiquidityToPool>,
    token_a_amount: u64,
    token_b_amount: u64,
) -> Result<()> {
    let total_lp_supply = ctx.accounts.lp_mint.supply;
    let total_a = ctx.accounts.vault_a.amount;
    let total_b = ctx.accounts.vault_b.amount;
    let mut is_initial = true;

    let (a_amount, b_amount) = if total_lp_supply != 0 {
        is_initial = false;

        let mut token_a_final_amount = token_a_amount as u128;
        let mut token_b_final_amount = token_b_amount as u128;

        let proportional_b = token_a_final_amount
            .checked_mul(total_b as u128)
            .ok_or(DEXError::MathOverflow)?
            .checked_div(total_a as u128)
            .ok_or(DEXError::MathOverflow)?;

        if proportional_b < token_b_final_amount {
            let proportional_a = token_b_final_amount
                .checked_mul(total_a as u128)
                .ok_or(DEXError::MathOverflow)?
                .checked_div(total_b as u128)
                .ok_or(DEXError::MathOverflow)?;

            if proportional_a < token_a_final_amount {
                return err!(DEXError::InvalidAmountOfLiquidation);
            }

            token_a_final_amount = proportional_a;
        } else {
            token_b_final_amount = proportional_b;
        }

        (token_a_final_amount, token_b_final_amount)
    } else {
        // initial deposit does not require checking
        (token_a_amount as u128, token_b_amount as u128)
    };

    let product = a_amount
        .checked_mul(b_amount)
        .ok_or(DEXError::MathOverflow)?;

    // NOTE: Minimum liquidity sent to an unusable address (like the system's address)
    // to prevent inflation attacks
    let liquidity = if is_initial {
        i_sqrt(product)
    } else {
        let a_anchored = a_amount
            .checked_mul(total_lp_supply as u128)
            .ok_or(DEXError::MathOverflow)?
            .checked_div(ctx.accounts.vault_a.amount as u128)
            .ok_or(DEXError::MathOverflow)?;

        let b_anchored = b_amount
            .checked_mul(total_lp_supply as u128)
            .ok_or(DEXError::MathOverflow)?
            .checked_div(ctx.accounts.vault_b.amount as u128)
            .ok_or(DEXError::MathOverflow)?;

        a_anchored.min(b_anchored)
    };

    let mint_a_key = ctx.accounts.mint_a.key();
    let mint_b_key = ctx.accounts.mint_b.key();

    let signer_seeds = get_pool_signer_seeds(
        &mint_a_key,
        &mint_b_key,
        &ctx.bumps.liquidity_pool,
    );
    let signer_seeds_slice: &[&[&[u8]]] = &[&signer_seeds];

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_a_account.to_account_info(),
                to: ctx.accounts.vault_a.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            },
        ),
        a_amount as u64,
    )?;

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_b_account.to_account_info(),
                to: ctx.accounts.vault_b.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            },
        ),
        b_amount as u64,
    )?;

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_tokens_account.to_account_info(),
                authority: ctx.accounts.liquidity_pool.to_account_info(),
            },
            signer_seeds_slice,
        ),
        liquidity as u64,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct AddLiquidityToPool<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        constraint = mint_a.key() < mint_b.key() @ DEXError::InvalidMintOrdering
    )]
    pub mint_a: InterfaceAccount<'info, Mint>,
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        seeds = [LIQUIDITY_POOL_SEED, mint_a.key().as_ref(), mint_b.key().as_ref()],
        bump
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
        init_if_needed,
        payer = signer,
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
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
