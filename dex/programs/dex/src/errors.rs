use anchor_lang::prelude::*;

#[error_code]
pub enum DEXError {
    #[msg("invalid bps value passed (more then 100 percent)")]
    InvalidBPSValue,

    #[msg("Math overflow ;(")]
    MathOverflow,

    #[msg("Invalid amount of liquidation deposited. Not enough tokens")]
    InvalidAmountOfLiquidation,
}
