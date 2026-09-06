"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo, PlanBadge } from "./ui";
import { useApp } from "./AppProvider";

export function MarketingNav() {
  const { user, plan } = useApp();
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#070a12]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/"><Logo /></Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm muted">
          <Link href="/#how" className="hover:text-white">How it works</Link>
          <Link href="/pricing" className="hover:text-white">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="btn btn-primary !py-2">Open app <PlanBadge plan={plan} /></Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost !py-2">Sign in</Link>
              <Link href="/register" className="btn btn-primary !py-2">Try Free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/podcasts", label: "My Podcasts", icon: "♫" },
  { href: "/podcasts/new", label: "Create", icon: "＋" },
  { href: "/settings/billing", label: "Billing", icon: "◈" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function AppShell({ children }) {
  const { user, plan, usage, logout, openUpgrade } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, router, pathname]);
  useEffect(() => setOpen(false), [pathname]);
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
      </div>
    );
  }
  const worst = usage ? Math.max(usage.podcasts.percent, usage.audioMinutes.percent) : 0;
  const Sidebar = (
    <div className="flex h-full flex-col p-4">
      <Link href="/dashboard" className="px-2 py-2"><Logo /></Link>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map((n) => {
          const active = n.href === "/settings" ? pathname === "/settings" : pathname.startsWith(n.href) && !(n.href === "/podcasts" && pathname.startsWith("/podcasts/new"));
          return (
            <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/10 text-white" : "muted hover:bg-white/5 hover:text-white"}`}>
              <span className="w-5 text-center">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3">
        {plan !== "CREATOR" && (
          <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-cyan-400/10 p-4">
            <div className="text-sm font-semibold">{worst >= 80 ? "Running low this month" : plan === "FREE" ? "Go Pro" : "Go Creator"}</div>
            <p className="mt-1 text-xs muted">{plan === "FREE" ? "Two hosts, Deep Dive, downloads and 500 audio minutes." : "Long-form, batch processing and custom branding."}</p>
            <button className="btn btn-primary mt-3 w-full !py-2 !text-xs" onClick={() => openUpgrade({ requiredPlan: plan === "FREE" ? "PRO" : "CREATOR" })}>Upgrade</button>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold flex items-center justify-center">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : (user.name || user.email)[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.name || user.email}</div>
            <PlanBadge plan={plan} />
          </div>
          <button onClick={logout} className="text-xs muted hover:text-white" title="Sign out">⎋</button>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block sticky top-0 h-screen border-r border-white/5 bg-[#0a0e1a]/60">{Sidebar}</aside>
      <div className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/5 bg-[#070a12]/80 px-4 backdrop-blur-xl">
        <Link href="/dashboard"><Logo /></Link>
        <button onClick={() => setOpen(true)} className="btn btn-ghost !px-2" aria-label="Menu">☰</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 glass-strong">{Sidebar}</aside>
        </div>
      )}
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
