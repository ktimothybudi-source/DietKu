import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionAffiliateId } from "@/lib/auth";

const STATUS_LABELS = {
  trial_active: "Free trial",
  converted: "Paid",
  expired: "Trial ended",
  cancelled: "Cancelled",
};

export async function GET() {
  const sessionAffiliateId = getSessionAffiliateId();
  if (!sessionAffiliateId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const { data: affiliate } = await supabase.from("affiliates").select("id").eq("id", sessionAffiliateId).maybeSingle();
  if (!affiliate?.id) return NextResponse.json({ error: "Affiliate account not found." }, { status: 404 });

  const { data: rows, error } = await supabase
    .from("referrals")
    .select("id,created_at,status,subscription_plan,amount_idr,commission_idr,trial_started_at,converted_at")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rows || [];
  const summary = {
    trialActive: list.filter((r) => r.status === "trial_active").length,
    converted: list.filter((r) => r.status === "converted").length,
    expired: list.filter((r) => r.status === "expired").length,
    cancelled: list.filter((r) => r.status === "cancelled").length,
  };

  return NextResponse.json({
    summary,
    rows: list.map((row) => ({
      id: row.id,
      date: row.converted_at || row.trial_started_at || row.created_at,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status] || row.status,
      plan: row.subscription_plan === "bulanan" ? "Monthly" : row.subscription_plan === "tahunan" ? "Yearly" : "—",
      saleAmount: Number(row.amount_idr || 0),
      commission: Number(row.commission_idr || 0),
    })),
  });
}
