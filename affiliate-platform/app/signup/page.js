"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    promoCode: "",
  });
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Creating account...");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        promoCode: form.promoCode.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to create account.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Create Affiliate Account</h1>
        <p>Sign up with email and password, then set your promo code.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Full name"
            required
          />
          <input
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            type="email"
            placeholder="Email"
            required
          />
          <input
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            type="password"
            placeholder="Password"
            minLength={6}
            required
          />
          <input
            value={form.promoCode}
            onChange={(e) => setForm((prev) => ({ ...prev, promoCode: e.target.value }))}
            placeholder="Promo code (e.g. DIETKU10)"
            required
          />
          <button type="submit" className="btn">Create account</button>
        </form>
        {status ? <p className={status.toLowerCase().includes("failed") ? "error" : "helper"}>{status}</p> : null}
        <p className="helper auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
