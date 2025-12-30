use anchor_lang::{prelude::InterfaceAccount, Key};
use anchor_spl::token_interface::Mint;

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
