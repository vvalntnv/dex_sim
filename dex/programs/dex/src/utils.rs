use anchor_lang::{prelude::*, Key};
use anchor_spl::token_interface::Mint;

use crate::{constants::LIQUIDITY_POOL_SEED, errors::DEXError};

pub fn i_sqrt(n: u128) -> u128 {
    if n < 2 {
        return n;
    }

    // A good initial guess is 2^(bits/2)
    // For u128, we use bit-shifting to get a ballpark figure
    let mut x = 1u128 << ((128 - n.leading_zeros() + 1) / 2);

    loop {
        let y = (x + n / x) >> 1; // Standard Newton: (x + n/x) / 2
        if y >= x {
            return x;
        }
        x = y;
    }
}

type _MintAccount<'info> = InterfaceAccount<'info, Mint>;

pub fn _order_two_mint_accounts<'a, 'info>(
    mint_a: &'a _MintAccount<'info>,
    mint_b: &'a _MintAccount<'info>,
) -> (&'a _MintAccount<'info>, &'a _MintAccount<'info>) {
    if mint_a.key() < mint_b.key() {
        (mint_a, mint_b)
    } else {
        (mint_b, mint_a)
    }
}

pub fn get_pool_signer_seeds<'a>(
    mint_a_key: &'a Pubkey,
    mint_b_key: &'a Pubkey,
    bump: &'a u8,
) -> [&'a [u8]; 4] {
    [
        LIQUIDITY_POOL_SEED,
        mint_a_key.as_ref(),
        mint_b_key.as_ref(),
        std::slice::from_ref(bump),
    ]
}

pub fn calculate_withdrawal_amounts(
    lp_tokens_to_burn: u64,
    total_lp_supply: u64,
    vault_a_amount: u64,
    vault_b_amount: u64,
) -> Result<(u64, u64)> {
    let lp_tokens = lp_tokens_to_burn as u128;
    let total_supply = total_lp_supply as u128;

    let amount_a = lp_tokens
        .checked_mul(vault_a_amount as u128)
        .ok_or(DEXError::MathOverflow)?
        .checked_div(total_supply)
        .ok_or(DEXError::MathOverflow)?;

    let amount_b = lp_tokens
        .checked_mul(vault_b_amount as u128)
        .ok_or(DEXError::MathOverflow)?
        .checked_div(total_supply)
        .ok_or(DEXError::MathOverflow)?;

    Ok((amount_a as u64, amount_b as u64))
}
