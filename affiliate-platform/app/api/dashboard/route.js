import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionAffiliateId } from "@/lib/auth";
import { getAffiliateCodeColumn, readAffiliateCode } from "@/lib/affiliateCodeColumn";

export async function GET() {
  const sessionAffiliateId = getSessionAffiliateId();
  if (!sessionAffiliateId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const codeColumn = await getAffiliateCodeColumn(supabase);
  const { data: affiliate } = await supabase
    .from("affiliates")
    .select(`id,${codeColumn}`)
    .eq("id", sessionAffiliateId)
    .maybeSingle();
  const affiliateId = affiliate?.id;
  if (!affiliateId) return NextResponse.json({ error: "Affiliate account not found." }, { status: 404 });

  const { data: commissions } = await supabase.from("commissions").select("amount_idr,status").eq("affiliate_id", affiliateId);
  const { data: referrals } = await supabase.from("referrals").select("id").eq("affiliate_id", affiliateId).eq("status", "converted");

  const total = (commissions || []).reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const pending = (commissions || [])
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const paid = (commissions || [])
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);

  return NextResponse.json({
    totals: {
      totalEarnings: total,
      pending,
      confirmed: Math.max(0, total - pending),
      paid,
      paidSignups: referrals?.length || 0,
    },
    referralLink: `${process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000"}/checkout?code=${readAffiliateCode(affiliate)}`,
    chart: [],
  });
}
