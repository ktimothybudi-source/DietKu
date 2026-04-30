import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionAffiliateId } from "@/lib/auth";

export async function GET() {
  const sessionAffiliateId = getSessionAffiliateId();
  if (!sessionAffiliateId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const { data: affiliate } = await supabase.from("affiliates").select("id").eq("id", sessionAffiliateId).maybeSingle();
  if (!affiliate?.id) return NextResponse.json({ error: "Affiliate account not found." }, { status: 404 });

  const { data: rows } = await supabase
    .from("referrals")
    .select("id,created_at,referred_user_id,amount_idr,commission_idr,status")
    .eq("affiliate_id", affiliate.id)
    .eq("status", "converted")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!rows?.length) return NextResponse.json({ rows: [] });

  return NextResponse.json({
    rows: rows.map((row) => ({
      id: row.id,
      date: row.created_at,
      subscriptionId: row.referred_user_id,
      amount: Number(row.amount_idr || 0),
      commission: Number(row.commission_idr || 0),
    })),
  });
}
