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

  const [{ data: commissions }, { data: referrals }] = await Promise.all([
    supabase
      .from("commissions")
      .select("id,created_at,amount_idr,status,referral_id")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("referrals")
      .select("id,created_at,status,commission_idr,converted_at,trial_started_at")
      .eq("affiliate_id", affiliate.id)
      .eq("status", "trial_active")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const commissionRows = commissions || [];
  const pending = commissionRows
    .filter((row) => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const paid = commissionRows
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const confirmed = commissionRows
    .filter((row) => row.status === "confirmed")
    .reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);

  const commissionHistory = commissionRows.map((row) => ({
    id: row.id,
    date: row.created_at,
    type: "Paid conversion",
    amount: Number(row.amount_idr || 0),
    status: row.status,
  }));

  const trialRows = (referrals || []).map((row) => ({
    id: `trial-${row.id}`,
    date: row.trial_started_at || row.created_at,
    type: "Free trial (pending)",
    amount: 0,
    status: "trial_active",
  }));

  const rows = [...trialRows, ...commissionHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return NextResponse.json({
    summary: { pending, confirmed, paid, activeTrials: trialRows.length },
    rows,
  });
}
