import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { setSessionCookie } from "@/lib/auth";
import { getAffiliateCodeColumn, getAffiliateCodeInfo } from "@/lib/affiliateCodeColumn";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  promoCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, "Promo code must be at least 4 characters.")
    .max(16, "Promo code must be at most 16 characters.")
    .regex(/^[A-Z0-9]+$/, "Promo code can only contain letters and numbers."),
});

export async function POST(request) {
  try {
    const { name, email, password, promoCode } = schema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    const codeColumn = await getAffiliateCodeColumn(supabase);
    const codeInfo = await getAffiliateCodeInfo(supabase);
    const normalizedEmail = email.toLowerCase();

    const { data: existingEmail } = await supabase.from("affiliates").select("id").eq("email", normalizedEmail).maybeSingle();
    if (existingEmail) {
      return NextResponse.json({ error: "Email already registered. Please login." }, { status: 409 });
    }

    const { data: existingCode } = await supabase.from("affiliates").select("id").eq(codeColumn, promoCode).maybeSingle();
    if (existingCode) {
      return NextResponse.json({ error: "Promo code already taken." }, { status: 409 });
    }

    const { data: createdUser, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const insertPayload = {
      name,
      email: normalizedEmail,
      [codeColumn]: promoCode,
    };
    if (codeInfo.hasPromoCode) {
      insertPayload.promo_code = promoCode;
    }
    if (codeInfo.hasReferralCode) {
      insertPayload.referral_code = promoCode;
    }

    const { data: affiliate, error: insertError } = await supabase
      .from("affiliates")
      .insert(insertPayload)
      .select(`id,name,email,${codeColumn}`)
      .single();

    if (insertError) {
      await supabase.auth.admin.deleteUser(createdUser.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const response = NextResponse.json({ affiliate });
    setSessionCookie(response, affiliate.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error?.issues?.[0]?.message || "Unable to sign up." }, { status: 400 });
  }
}
