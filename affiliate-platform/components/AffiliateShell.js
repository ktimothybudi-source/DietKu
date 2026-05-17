"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/referrals", label: "Referrals" },
  { href: "/earnings", label: "Earnings" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/settings", label: "Settings" },
];

export default function AffiliateShell({ title, subtitle, children, badge = "Silver" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/affiliates/promo-code").then(async (res) => {
      if (!active) return;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const payload = await res.json();
      setEmail(payload.email || "");
    });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1 className="brand">DietKu Affiliates</h1>
        <p className="menu-label">{email ? `Signed in: ${email}` : "Signed in: ..."}</p>
        <p className="menu-label">Menu</p>
        <nav className="nav-list">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? "nav-item active" : "nav-item"}>
              {item.label}
            </Link>
          ))}
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </aside>
      <main className="main">
        <header className="main-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="badge-row">
            <span className="plan-badge">{badge}</span>
            <span className="status-badge">approved</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
