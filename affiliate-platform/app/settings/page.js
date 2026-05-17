"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateShell from "@/components/AffiliateShell";

export default function SettingsPage() {
  const router = useRouter();
  const [promoCode, setPromoCode] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    fetch("/api/affiliates/promo-code").then(async (res) => {
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = await res.json();
      setPromoCode(payload.promoCode || "DIETKU10");
      setEmail(payload.email || "");
    });
  }, [router]);

  const normalizedCode = useMemo(() => promoCode.toUpperCase().replace(/[^A-Z0-9]/g, ""), [promoCode]);

  async function checkAvailability() {
    if (normalizedCode.length < 4) {
      setAvailability({ ok: false, message: "Promo code must be at least 4 characters." });
      return;
    }
    const res = await fetch(`/api/affiliates/code-availability?code=${encodeURIComponent(normalizedCode)}`);
    const payload = await res.json();
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    setAvailability({ ok: payload.available, message: payload.available ? "Promo code is available." : payload.error || "Promo code is not available." });
  }

  async function savePromoCode(e) {
    e.preventDefault();
    setStatus("Saving...");
    const res = await fetch("/api/affiliates/promo-code", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoCode: normalizedCode }),
    });
    const payload = await res.json();
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setStatus(payload.error || "Failed to update promo code.");
      return;
    }
    setPromoCode(payload.promoCode);
    setStatus(payload.message || "Promo code updated.");
  }

  return (
    <AffiliateShell title="Settings" subtitle="Manage account and promo code">
      <section className="card">
        <h3>Customize Promo Code</h3>
        <p className="helper">This promo code appears in your checkout referral link.</p>
        <p className="helper">Current affiliate commission: 30% of each converted subscription.</p>
        <p className="helper">Signed in as: {email || "Loading..."}</p>
        <form className="form-row" onSubmit={savePromoCode}>
          <input
            value={normalizedCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter promo code"
            maxLength={16}
          />
          <button type="button" className="btn secondary" onClick={checkAvailability}>
            Check availability
          </button>
          <button type="submit" className="btn">
            Save promo code
          </button>
        </form>
        {availability ? <p className={availability.ok ? "ok" : "error"}>{availability.message}</p> : null}
        {status ? <p className={status.toLowerCase().includes("fail") ? "error" : "ok"}>{status}</p> : null}
      </section>
    </AffiliateShell>
  );
}
