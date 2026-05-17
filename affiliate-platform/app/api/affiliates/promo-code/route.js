import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionAffiliateId } from "@/lib/auth";
import { getAffiliateCodeColumn, getAffiliateCodeInfo, readAffiliateCode } from "@/lib/affiliateCodeColumn";

const schema = z.object({
  promoCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Promo code must be at least 4 characters.")
    .max(16, "Promo code must be at most 16 characters.")
    .regex(/^[A-Z0-9]+$/, "Promo code can only contain letters and numbers."),
});

export async function GET() {
  const sessionAffiliateId = getSessionAffiliateId();
  if (!sessionAffiliateId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const codeColumn = await getAffiliateCodeColumn(supabase);
  const { data } = await supabase.from("affiliates").select(`email,${codeColumn}`).eq("id", sessionAffiliateId).maybeSingle();
  return NextResponse.json({ promoCode: readAffiliateCode(data), email: data?.email || "" });
}

export async function PATCH(request) {
  try {
    const { promoCode } = schema.parse(await request.json());
    const sessionAffiliateId = getSessionAffiliateId();
    if (!sessionAffiliateId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const codeColumn = await getAffiliateCodeColumn(supabase);
    const codeInfo = await getAffiliateCodeInfo(supabase);
    const { data: existing } = await supabase
      .from("affiliates")
      .select("id")
      .eq(codeColumn, promoCode)
      .neq("id", sessionAffiliateId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Promo code already used by another affiliate." }, { status: 409 });
    }

    const { data: affiliate } = await supabase.from("affiliates").select("id").eq("id", sessionAffiliateId).maybeSingle();
    if (!affiliate) {
      return NextResponse.json({ error: "Affiliate account not found." }, { status: 404 });
    }

    const updatePayload = { [codeColumn]: promoCode };
    if (codeInfo.hasPromoCode) {
      updatePayload.promo_code = promoCode;
    }
    if (codeInfo.hasReferralCode) {
      updatePayload.referral_code = promoCode;
    }

    const { error } = await supabase.from("affiliates").update(updatePayload).eq("id", affiliate.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ promoCode, message: "Promo code updated successfully." });
  } catch (error) {
    const message = error?.issues?.[0]?.message || error?.message || "Unable to update promo code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
