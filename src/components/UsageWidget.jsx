"use client";
import Link from "next/link";
import { ProgressBar, PlanBadge } from "./ui";
import { useApp } from "./AppProvider";
import { formatBytes } from "@/lib/format";

function Row({ label, used, limit, unit = "", percent }) {
  const near = percent >= 80 && percent < 100;
  const full = percent >= 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="muted">{label}</span>
        <span className="font-semibold tabular-nums">
          {used} <span className="muted font-normal">/ {limit}{unit}</span>
        </span>
      </div>
      <ProgressBar percent={percent} className="mt-2" />
      {full && <div className="mt-1.5 text-xs text-rose-300">Monthly limit reached</div>}
      {near && <div className="mt-1.5 text-xs text-amber-300">You've used {percent}% of your monthly {label.toLowerCase()}.</div>}
    </div>
  );
}

export default function UsageWidget({ compact = false }) {
  const { usage, plan, planConfig, openUpgrade, subscription } = useApp();
  if (!usage) return <div className="card p-5 animate-pulse h-40" />;
  const worst = Math.max(usage.podcasts.percent, usage.audioMinutes.percent);
  const renew = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide muted">Current plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-bold">{planConfig?.name || plan}</span>
            <PlanBadge plan={plan} />
          </div>
        </div>
        {plan !== "CREATOR" && (
          <button className="btn btn-primary !py-2 !px-3 !text-xs" onClick={() => openUpgrade({ requiredPlan: plan === "PRO" ? "CREATOR" : "PRO" })}>
            Upgrade plan
          </button>
        )}
      </div>
      <div className={`mt-5 grid gap-5 ${compact ? "" : "sm:grid-cols-2"}`}>
        <Row label="Podcasts" used={usage.podcasts.used} limit={usage.podcasts.limit} percent={usage.podcasts.percent} />
        <Row label="Audio minutes" used={usage.audioMinutes.used} limit={usage.audioMinutes.limit} unit=" min" percent={usage.audioMinutes.percent} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs muted border-t border-white/5 pt-4">
        <span>PDF usage: up to {usage.pdf.maxPages} pages · {formatBytes(usage.pdf.maxFileSize)} per file</span>
        {renew && <span>Resets {renew}</span>}
      </div>
      {worst >= 80 && plan !== "CREATOR" && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100 flex items-center justify-between gap-2">
          <span>{worst >= 100 ? "You've hit a monthly limit." : "You're close to a monthly limit."} Need more room?</span>
          <Link href="/settings/billing" className="font-semibold underline underline-offset-2">See plans</Link>
        </div>
      )}
    </div>
  );
}
