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
    .from("commissions")
    .select("id,created_at,amount_idr,status")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!rows?.length) {
    return NextResponse.json({
      summary: { pending: 0, confirmed: 0, paid: 0 },
      rows: [],
    });
  }

  const pending = rows.filter((row) => row.status === "pending").reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const paid = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);
  const confirmed = rows.filter((row) => row.status === "confirmed").reduce((sum, row) => sum + Number(row.amount_idr || 0), 0);

  return NextResponse.json({
    summary: { pending, confirmed, paid },
    rows: rows.map((row) => ({
      id: row.id,
      date: row.created_at,
      type: "conversion",
      amount: Number(row.amount_idr || 0),
      status: row.status,
    })),
  });
}
