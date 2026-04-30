"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/earnings", label: "Earnings" },
  { href: "/referrals", label: "Referrals" },
  { href: "/settings", label: "Settings" },
];

export default function AffiliateShell({ title, subtitle, children, badge = "Silver" }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1 className="brand">DietKu Affiliates</h1>
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
