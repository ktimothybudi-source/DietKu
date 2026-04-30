let cachedColumn = null;

export async function getAffiliateCodeColumn(supabase) {
  if (cachedColumn) return cachedColumn;

  const { error } = await supabase.from("affiliates").select("promo_code").limit(1);
  if (!error) {
    cachedColumn = "promo_code";
    return cachedColumn;
  }

  cachedColumn = "referral_code";
  return cachedColumn;
}

export function readAffiliateCode(affiliate) {
  return affiliate?.promo_code || affiliate?.referral_code || "DIETKU10";
}
