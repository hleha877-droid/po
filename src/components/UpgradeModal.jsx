"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Modal, Spinner } from "./ui";
import { useApp } from "./AppProvider";
import { api } from "@/lib/api";

const HIGHLIGHTS = ["50 podcasts/month", "500 audio minutes", "Two AI hosts", "MP3 downloads", "Deep Dive", "Study Mode", "Premium voices"];
const CREATOR_HIGHLIGHTS = ["200 podcasts/month", "2,000 audio minutes", "Long-form podcasts", "Batch PDF processing", "Custom branding", "Advanced voice selection", "Priority processing"];

export default function UpgradeModal({ open, onClose, context }) {
  const { user, plans, plan, refresh, toast, system } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const target = context?.requiredPlan === "CREATOR" || plan === "PRO" ? "CREATOR" : "PRO";
  const targetPlan = plans?.plans?.[target];
  const highlights = target === "CREATOR" ? CREATOR_HIGHLIGHTS : HIGHLIGHTS;
  const isMock = system?.mockBilling;

  async function upgradeNow() {
    if (!user) {
      onClose();
      router.push(`/register?plan=${target}`);
      return;
    }
    setBusy(true);
    try {
      const res = await api("/api/billing/checkout", { method: "POST", body: { planId: target, returnUrl: window.location.pathname } });
      if (res.checkout?.url) {
        window.location.href = res.checkout.url;
        return;
      }
      await refresh();
      toast(`You're now on ${targetPlan?.name || target}. ${isMock ? "(Mock billing — no payment was made.)" : ""}`, "success", "Plan updated");
      onClose();
    } catch (e) {
      toast(e.message, "error", "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl">
      <div className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white" aria-label="Close">✕</button>
        <div className="relative">
          <div className={target === "CREATOR" ? "badge badge-creator" : "badge badge-pro"}>{target === "CREATOR" ? "Creator" : "Pro"}</div>
          <h2 className="mt-3 pr-8 text-2xl sm:text-3xl font-bold tracking-tight break-words">Unlock the full PodMind experience</h2>
          {context?.reason && (
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">🔒 {context.reason}</div>
          )}
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {highlights.map((h, i) => (
              <motion.li key={h} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }} className="flex items-center gap-2.5 text-sm">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-[11px] text-white">✓</span>
                {h}
              </motion.li>
            ))}
          </ul>
          <div className="mt-6 flex items-end gap-2">
            <span className="text-4xl font-bold">${targetPlan?.price?.toFixed(2) || (target === "CREATOR" ? "19.99" : "7.99")}</span>
            <span className="muted mb-1.5 text-sm">/month{targetPlan?.approxLocal?.amount ? ` · ≈ ${targetPlan.approxLocal.symbol}${targetPlan.approxLocal.amount}` : ""}</span>
          </div>
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button className="btn btn-primary min-w-0 flex-1 whitespace-normal break-words py-3" onClick={upgradeNow} disabled={busy}>
              {busy ? <Spinner /> : null} Upgrade to {targetPlan?.name || target}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Maybe later</button>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs muted">
            <span>Cancel anytime.</span>
            <a href="/pricing" className="hover:text-white underline-offset-2 hover:underline" onClick={onClose}>Compare all plans →</a>
          </div>
          {isMock && <div className="mt-3 text-[11px] text-slate-500">Development mode: mock billing is active. No real payment is processed.</div>}
        </div>
      </div>
    </Modal>
  );
}
