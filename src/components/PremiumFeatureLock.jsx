"use client";
import { useApp } from "./AppProvider";

const ORDER = ["FREE", "PRO", "CREATOR"];
export function planAtLeast(current, required) {
  return ORDER.indexOf(current || "FREE") >= ORDER.indexOf(required || "FREE");
}

/**
 * Wraps a premium feature. If the user's plan is below `plan`, renders the children in a
 * locked state with a "🔒 Pro" tag and an Upgrade button that opens the upgrade modal.
 * Presentation only — the backend enforces every restriction independently.
 */
export default function PremiumFeatureLock({ plan = "PRO", feature, reason, children, inline = false, className = "" }) {
  const { plan: current, openUpgrade } = useApp();
  const unlocked = planAtLeast(current, plan);
  if (unlocked) return children;
  const label = plan === "CREATOR" ? "Creator" : "Pro";
  const msg = reason || `Upgrade to ${label} to unlock ${feature || "this feature"}.`;
  const open = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    openUpgrade({ reason: msg, requiredPlan: plan, feature });
  };
  if (inline) {
    return (
      <button type="button" onClick={open} className={`inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300 hover:text-white ${className}`}>
        🔒 {label} <span className="underline underline-offset-2">Upgrade</span>
      </button>
    );
  }
  return (
    <div className={`relative group ${className}`} onClickCapture={open}>
      <div className="pointer-events-none opacity-50 saturate-50">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-black/30 opacity-95 transition group-hover:bg-black/40">
        <span className={plan === "CREATOR" ? "badge badge-creator" : "badge badge-pro"}>🔒 {label}</span>
        <span className="hidden sm:block px-3 text-center text-[11px] text-slate-200">{msg}</span>
        <button type="button" className="btn btn-primary !py-1.5 !px-3 !text-xs" onClick={open}>Upgrade</button>
      </div>
    </div>
  );
}
