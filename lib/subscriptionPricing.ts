/**
 * IDR anchors when store / RevenueCat price strings are unavailable.
 * Displayed store prices may round (Play/App Store UI).
 */
const MONTHLY_IDR = 39000;
const YEARLY_IDR = 129000;

export const SUBSCRIPTION_MONTHLY_IDR_FALLBACK = 'Rp 39.000';
export const SUBSCRIPTION_YEARLY_IDR_FALLBACK = 'Rp 129.000';

/** Rounded monthly equivalent of the yearly price (for “setara / bulan” copy). */
export const SUBSCRIPTION_YEARLY_EQUIV_MONTHLY_ROUNDED = Math.round(YEARLY_IDR / 12);

/** Savings vs paying the monthly rate for 12 months. */
export const SUBSCRIPTION_YEARLY_SAVINGS_PCT_VS_MONTHLY = Math.round(
  (1 - YEARLY_IDR / (MONTHLY_IDR * 12)) * 100
);
