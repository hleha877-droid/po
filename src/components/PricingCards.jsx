"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useApp } from "./AppProvider";
import { api } from "@/lib/api";
import { Spinner } from "./ui";

const ORDER = ["FREE", "PRO", "CREATOR"];
export const CTA = { FREE: "Try Free", PRO: "Start Pro", CREATOR: "Start Creating" };

export function usePlanAction() {
  const { user, plan, refresh, toast, system } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const isMock = system?.billing === "mock";
  async function act(targetId) {
    if (!user) return router.push(targetId === "FREE" ? "/register" : `/register?plan=${targetId}`);
    if (targetId === plan) return router.push("/dashboard");
    setBusy(targetId);
    try {
      const upgrade = ORDER.indexOf(targetId) > ORDER.indexOf(plan);
      const res = upgrade
        ? await api("/api/billing/checkout", { method: "POST", body: { planId: targetId, returnUrl: "/settings/billing" } })
        : await api("/api/billing/change-plan", { method: "POST", body: { planId: targetId } });
      if (res.checkout?.url) return (window.location.href = res.checkout.url);
      await refresh();
      toast(`Your plan is now ${targetId}.${isMock ? " (Mock billing — no payment was made.)" : ""}`, "success", upgrade ? "Upgraded" : "Plan changed");
    } catch (e) {
      toast(e.message, "error", "Billing");
    } finally {
      setBusy(null);
    }
  }
  return { act, busy, currentPlan: plan, user };
}

export default function PricingCards({ compact = false }) {
  const { plans } = useApp();
  const { act, busy, currentPlan, user } = usePlanAction();
  if (!plans) return <div className="grid gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="card h-96 animate-pulse" />)}</div>;
  return (
    <div className="grid gap-5 md:grid-cols-3 items-stretch">
      {ORDER.map((id, i) => {
        const p = plans.plans[id];
        const isPro = id === "PRO";
        const isCreator = id === "CREATOR";
        const current = user && currentPlan === id;
        const features = compact ? p.features.slice(0, 6) : p.features;
        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className={`relative flex flex-col rounded-3xl p-6 sm:p-7 ${isPro ? "glass-strong pro-glow md:-translate-y-3" : "card"} ${isCreator ? "border-pink-400/20" : ""}`}
          >
            {p.badge && (
              <div className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap ${isPro ? "badge badge-pro" : "badge badge-creator"} !px-3 !py-1 shadow-lg`}>{p.badge}</div>
            )}
            <div className="text-sm font-semibold muted">{p.name}</div>
            <div className="mt-2 flex items-end gap-1.5">
              <span className="text-4xl font-bold tracking-tight">${p.price === 0 ? "0" : p.price.toFixed(2)}</span>
              <span className="muted mb-1 text-sm">/month</span>
            </div>
            <div className="mt-1 text-xs muted h-4">{p.price > 0 && p.approxLocal?.amount ? `≈ ${p.approxLocal.symbol}${p.approxLocal.amount.toLocaleString("en-US")} / month` : p.tagline}</div>
            <button
              onClick={() => act(id)}
              disabled={busy === id || current}
              className={`btn mt-5 min-w-0 w-full whitespace-normal break-words text-center py-3 ${isPro ? "btn-primary" : isCreator ? "btn-secondary border-pink-400/30 hover:bg-pink-400/10" : "btn-secondary"}`}
            >
              {busy === id ? <Spinner /> : null}
              {current ? "Current plan" : CTA[id]}
            </button>
            <ul className="mt-6 space-y-2.5 text-sm">
              {features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <span className={`mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] ${isPro ? "bg-violet-500/30 text-violet-200" : isCreator ? "bg-pink-500/20 text-pink-200" : "bg-white/10 text-slate-300"}`}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
              {!compact && p.limitations?.map((f) => (
                <li key={f} className="flex gap-2.5 muted">
                  <span className="mt-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px]">–</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {compact && <Link href="/pricing" className="mt-4 text-xs muted hover:text-white">See everything included →</Link>}
            <div className="mt-auto pt-6 text-center text-xs muted">{p.price > 0 ? "Cancel anytime." : "No credit card required."}</div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function ComparisonTable() {
  const { plans } = useApp();
  if (!plans) return null;
  const cell = (v) => (typeof v === "boolean" ? (v ? <span className="text-emerald-300">✓</span> : <span className="text-slate-600">—</span>) : <span>{v}</span>);
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="p-4 font-medium muted">Feature</th>
              {ORDER.map((id) => (
                <th key={id} className={`p-4 text-center font-semibold ${id === "PRO" ? "text-violet-200" : ""}`}>{plans.plans[id].name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.comparison.map((row, i) => (
              <tr key={row.key} className={i % 2 ? "bg-white/[0.02]" : ""}>
                <td className="p-4 muted">{row.label}</td>
                {ORDER.map((id) => (
                  <td key={id} className={`p-4 text-center ${id === "PRO" ? "bg-violet-500/5" : ""}`}>{cell(row.values[id])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
