"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateShell from "@/components/AffiliateShell";
import StatCard from "@/components/StatCard";
import { formatIdr, formatShortDate } from "@/lib/format";

export default function EarningsPage() {
  const router = useRouter();
  const [data, setData] = useState({ summary: { pending: 0, confirmed: 0, paid: 0 }, rows: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/earnings")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = await res.json();
        if (!res.ok) {
          setError(payload?.error || "Failed to load earnings.");
          setData({ summary: { pending: 0, confirmed: 0, paid: 0 }, rows: [] });
          return;
        }

        const normalizedSummary = {
          pending: Number(payload?.summary?.pending || 0),
          confirmed: Number(payload?.summary?.confirmed || 0),
          paid: Number(payload?.summary?.paid || 0),
        };
        const normalizedRows = Array.isArray(payload?.rows) ? payload.rows : [];
        setError("");
        setData({ summary: normalizedSummary, rows: normalizedRows });
      })
      .catch(() => {
        setError("Failed to load earnings.");
        setData({ summary: { pending: 0, confirmed: 0, paid: 0 }, rows: [] });
      });
  }, [router]);

  return (
    <AffiliateShell title="Earnings" subtitle="Track your commissions and payouts">
      <section className="stats-grid">
        <StatCard label="Pending" value={formatIdr(data.summary.pending)} />
        <StatCard label="Confirmed" value={formatIdr(data.summary.confirmed)} />
        <StatCard label="Total Paid" value={formatIdr(data.summary.paid)} />
      </section>

      <section className="card">
        <h3>Transaction History</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>{formatShortDate(row.date)}</td>
                <td>
                  <span className="pill">{row.type}</span>
                </td>
                <td className="positive">+{formatIdr(row.amount)}</td>
                <td>
                  <span className="pill success">{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AffiliateShell>
  );
}
