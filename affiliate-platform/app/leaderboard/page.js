"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateShell from "@/components/AffiliateShell";

export default function LeaderboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const payload = await res.json();
        if (!res.ok) {
          setError(payload?.error || "Failed to load leaderboard.");
          setRows([]);
          return;
        }
        setError("");
        setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      })
      .catch(() => {
        setError("Failed to load leaderboard.");
        setRows([]);
      });
  }, [router]);

  return (
    <AffiliateShell title="Leaderboard" subtitle="Top affiliates by monthly and yearly sales">
      <section className="card">
        <h3>Sales Ranking</h3>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Affiliate</th>
              <th>Email</th>
              <th>Code</th>
              <th>Bulanan</th>
              <th>Tahunan</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.rank}</td>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td className="mono">{row.promoCode}</td>
                <td>{row.bulananSales}</td>
                <td>{row.tahunanSales}</td>
                <td className="positive">{row.totalSales}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </AffiliateShell>
  );
}
