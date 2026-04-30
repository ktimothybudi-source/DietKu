"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Signing in...");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to sign in.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>DietKu Affiliates</h1>
        <p>Login with your affiliate email and password.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            required
          />
          <button type="submit" className="btn">Sign in</button>
        </form>
        {status ? <p className={status.toLowerCase().includes("failed") ? "error" : "helper"}>{status}</p> : null}
        <p className="helper auth-switch">
          New affiliate? <Link href="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
