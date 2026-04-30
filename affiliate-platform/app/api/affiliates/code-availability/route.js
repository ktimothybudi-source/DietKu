import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionAffiliateId } from "@/lib/auth";
import { getAffiliateCodeColumn } from "@/lib/affiliateCodeColumn";

export async function GET(request) {
  const sessionAffiliateId = getSessionAffiliateId();
  if (!sessionAffiliateId) {
    return NextResponse.json({ available: false, error: "Unauthorized." }, { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ available: false, error: "Promo code is required." }, { status: 400 });
  }

  if (!/^[A-Z0-9]{4,16}$/.test(code)) {
    return NextResponse.json({ available: false, error: "Use 4-16 letters or numbers." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ available: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const codeColumn = await getAffiliateCodeColumn(supabase);
  const { data, error } = await supabase
    .from("affiliates")
    .select("id")
    .eq(codeColumn, code)
    .neq("id", sessionAffiliateId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ available: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ available: !data });
}
