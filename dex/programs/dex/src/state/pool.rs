use anchor_lang::prelude::*;

#[account]
pub struct Pool {
    pub vault_a: Pubkey,
    pub vault_b: Pubkey,
    pub mint_a: Pubkey,
    pub mint_b: Pubkey,
    pub lp_mint: Pubkey,
    pub fee_bps: u64,
    pub bump: u8,
}

impl Pool {
    // 5 pubkeys + fee + bump
    pub const MAX_SIZE: usize = 8 + 5 * 32 + 8 + 1;
}
