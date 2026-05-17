"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateShell from "@/components/AffiliateShell";
import StatCard from "@/components/StatCard";
import { formatIdr, formatShortDate } from "@/lib/format";

export default function ReferralsPage() {
  const router = useRouter();
  const [data, setData] = useState({ summary: { trialActive: 0, converted: 0, expired: 0 }, rows: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/referrals")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = await res.json();
        if (!res.ok) {
          setError(payload?.error || "Failed to load referrals.");
          return;
        }
        setError("");
        setData({
          summary: payload.summary || { trialActive: 0, converted: 0, expired: 0 },
          rows: Array.isArray(payload.rows) ? payload.rows : [],
        });
      })
      .catch(() => setError("Failed to load referrals."));
  }, [router]);

  const { summary, rows } = data;

  return (
    <AffiliateShell title="Referrals" subtitle="Trial starts vs paid conversions from your promo code">
      <section className="stats-grid">
        <StatCard label="Active trials" value={String(summary.trialActive || 0)} />
        <StatCard label="Paid conversions" value={String(summary.converted || 0)} />
        <StatCard label="Trial ended (no pay)" value={String(summary.expired || 0)} />
      </section>

      <section className="card">
        <h3>Referral activity</h3>
        <p className="helper">
          Free trial = buyer redeemed your code in the app (not paid yet). Paid = first subscription charge after trial.
          Commission (30%) is calculated only on paid conversions.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Sale</th>
              <th>Your commission</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="helper">
                  No referrals yet. Share your promo link from the dashboard.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatShortDate(row.date)}</td>
                  <td>
                    <span
                      className={
                        row.status === "converted"
                          ? "pill success"
                          : row.status === "trial_active"
                            ? "pill warn"
                            : "pill"
                      }
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                  <td>{row.plan}</td>
                  <td>{row.saleAmount > 0 ? formatIdr(row.saleAmount) : "—"}</td>
                  <td className={row.commission > 0 ? "positive" : ""}>
                    {row.commission > 0 ? `+${formatIdr(row.commission)}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AffiliateShell>
  );
}
