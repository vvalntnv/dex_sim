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
