"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateShell from "@/components/AffiliateShell";
import StatCard from "@/components/StatCard";
import CopyField from "@/components/CopyField";
import { formatIdr } from "@/lib/format";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/dashboard").then(async (res) => {
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      setData(await res.json());
    });
  }, [router]);

  const totals = data?.totals || {};

  return (
    <AffiliateShell title="Dashboard" subtitle="Overview of your affiliate performance">
      <section className="stats-grid">
        <StatCard label="Total Earnings" value={formatIdr(totals.totalEarnings)} />
        <StatCard label="Pending" value={formatIdr(totals.pending)} />
        <StatCard label="Confirmed" value={formatIdr(totals.confirmed)} />
        <StatCard label="Paid" value={formatIdr(totals.paid)} />
      </section>

      <section className="stats-grid">
        <StatCard label="Active free trials" value={String(totals.trialSignups || 0)} />
        <StatCard label="Paid conversions" value={String(totals.paidSignups || 0)} />
      </section>

      <section className="card link-card">
        <div>
          <p className="label">Your referral link</p>
          <p className="helper">
            Commission: 30% when a referred user pays after trial. Free trials appear under Referrals until they convert.
          </p>
        </div>
        <CopyField value={data?.referralLink || "https://dietku.id/checkout?code=DIETKU10"} />
      </section>

      <section className="card">
        <p className="label">Earnings Overview</p>
        <h3>{formatIdr(totals.totalEarnings || 0)}</h3>
        <p className="helper">Total earnings over time</p>
        <div className="chart-wrap">
          {(data?.chart || []).map((value, idx) => (
            <div key={`${value}-${idx}`} className="bar">
              <span style={{ height: `${Math.max(8, (value / 700000) * 100)}%` }} />
            </div>
          ))}
        </div>
      </section>
    </AffiliateShell>
  );
}
