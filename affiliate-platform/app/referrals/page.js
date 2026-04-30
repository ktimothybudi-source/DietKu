"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateShell from "@/components/AffiliateShell";
import { formatIdr, formatShortDate } from "@/lib/format";

export default function ReferralsPage() {
  const router = useRouter();
  const [data, setData] = useState({ rows: [] });
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
          setData({ rows: [] });
          return;
        }

        const normalizedRows = Array.isArray(payload?.rows) ? payload.rows : [];
        setError("");
        setData({ rows: normalizedRows });
      })
      .catch(() => {
        setError("Failed to load referrals.");
        setData({ rows: [] });
      });
  }, [router]);

  return (
    <AffiliateShell title="Referrals" subtitle="View your referral conversions">
      <section className="card">
        <h3>Conversion History</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Subscription</th>
              <th>Amount</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <td>{formatShortDate(row.date)}</td>
                <td className="mono">{row.subscriptionId}</td>
                <td>{formatIdr(row.amount)}</td>
                <td className="positive">+{formatIdr(row.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AffiliateShell>
  );
}
