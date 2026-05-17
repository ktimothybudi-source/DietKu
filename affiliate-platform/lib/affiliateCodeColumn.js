let cachedInfo = null;

export async function getAffiliateCodeColumn(supabase) {
  const info = await getAffiliateCodeInfo(supabase);
  return info.primary;
}

export async function getAffiliateCodeInfo(supabase) {
  if (cachedInfo) return cachedInfo;

  const { error: promoError } = await supabase.from("affiliates").select("promo_code").limit(1);
  const hasPromoCode = !promoError;

  const { error: referralError } = await supabase.from("affiliates").select("referral_code").limit(1);
  const hasReferralCode = !referralError;

  if (hasPromoCode) {
    cachedInfo = { primary: "promo_code", hasPromoCode, hasReferralCode };
    return cachedInfo;
  }

  cachedInfo = { primary: "referral_code", hasPromoCode, hasReferralCode };
  return cachedInfo;
}

export function readAffiliateCode(affiliate) {
  return affiliate?.promo_code || affiliate?.referral_code || "DIETKU10";
}
