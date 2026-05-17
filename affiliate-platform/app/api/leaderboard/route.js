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

  const { data: me } = await supabase.from("affiliates").select("id").eq("id", sessionAffiliateId).maybeSingle();
  if (!me?.id) return NextResponse.json({ error: "Affiliate account not found." }, { status: 404 });

  const codeColumn = await getAffiliateCodeColumn(supabase);
  const { data: affiliates } = await supabase.from("affiliates").select(`id,name,email,${codeColumn}`);
  const { data: referrals } = await supabase
    .from("referrals")
    .select("affiliate_id,subscription_plan,status")
    .eq("status", "converted");

  const statsByAffiliate = new Map();
  for (const row of referrals || []) {
    const key = row.affiliate_id;
    const current = statsByAffiliate.get(key) || { bulanan: 0, tahunan: 0 };
    if (row.subscription_plan === "tahunan") {
      current.tahunan += 1;
    } else {
      current.bulanan += 1;
    }
    statsByAffiliate.set(key, current);
  }

  const rows = (affiliates || [])
    .map((affiliate) => {
      const stat = statsByAffiliate.get(affiliate.id) || { bulanan: 0, tahunan: 0 };
      return {
        id: affiliate.id,
        name: affiliate.name || "-",
        email: affiliate.email || "-",
        promoCode: readAffiliateCode(affiliate),
        bulananSales: stat.bulanan,
        tahunanSales: stat.tahunan,
        totalSales: stat.bulanan + stat.tahunan,
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales || b.tahunanSales - a.tahunanSales || b.bulananSales - a.bulananSales)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return NextResponse.json({ rows });
}
