"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import UsageWidget from "@/components/UsageWidget";
import PricingCards from "@/components/PricingCards";
import { PlanBadge, Spinner } from "@/components/ui";
import { formatDate } from "@/lib/format";

export default function BillingPage() {
  const { subscription, plan, planConfig, refresh, toast, handleError, system } = useApp();
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(null);
  const load = () => api("/api/billing/history").then((r) => setHistory(r.events)).catch(() => {});
  useEffect(() => { load(); }, [subscription?.plan, subscription?.status]);
  const isMock = system?.billing === "mock";

  async function cancel() {
    if (!confirm(`Cancel your ${planConfig?.name} subscription? You'll keep access until ${formatDate(subscription?.currentPeriodEnd)}.`)) return;
    setBusy("cancel");
    try {
      await api("/api/billing/cancel", { method: "POST" });
      await refresh();
      toast("Subscription canceled. You keep your features until the period ends.", "success");
    } catch (e) { handleError(e); } finally { setBusy(null); }
  }
  async function resume() {
    setBusy("resume");
    try {
      await api("/api/billing/change-plan", { method: "POST", body: { planId: subscription.requestedPlan } });
      await refresh();
      toast("Subscription renewed.", "success");
    } catch (e) { handleError(e); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Billing</h1>
        <p className="mt-1 muted">Manage your plan, usage and payment details.</p>
      </div>
      {isMock && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-100">
          <b>Mock billing mode.</b> Plan changes are simulated for development and testing — no payment provider is connected and no money is charged.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <UsageWidget />
        </div>
        <div className="space-y-6">
          <div className="card p-5">
            <div className="text-xs uppercase tracking-wide muted">Current plan</div>
            <div className="mt-1 flex items-center gap-2"><span className="text-2xl font-bold">{planConfig?.name}</span><PlanBadge plan={plan} /></div>
            <div className="mt-1 text-sm muted">{planConfig?.price ? `$${planConfig.price.toFixed(2)} / month` : "Free forever"}</div>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="muted">Status</span><span className="capitalize">{subscription?.status}{subscription?.cancelAtPeriodEnd ? " (ends at period end)" : ""}</span></div>
              {subscription?.currentPeriodEnd && <div className="flex justify-between"><span className="muted">{subscription.cancelAtPeriodEnd ? "Access until" : "Renews"}</span><span>{formatDate(subscription.currentPeriodEnd)}</span></div>}
              <div className="flex justify-between"><span className="muted">Provider</span><span className="capitalize">{subscription?.provider}</span></div>
            </div>
            {plan !== "FREE" && !subscription?.cancelAtPeriodEnd && (
              <button className="btn btn-danger mt-4 w-full !py-2" onClick={cancel} disabled={busy === "cancel"}>{busy === "cancel" && <Spinner />} Cancel subscription</button>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <button className="btn btn-primary mt-4 w-full !py-2" onClick={resume} disabled={busy === "resume"}>{busy === "resume" && <Spinner />} Renew subscription</button>
            )}
          </div>
          <div className="card p-5">
            <div className="font-semibold">Payment method</div>
            <div className="mt-3 rounded-xl border border-dashed border-white/15 p-4 text-sm muted text-center">
              {isMock ? "No payment method — mock billing." : "No payment method on file."}
            </div>
            <button className="btn btn-secondary mt-3 w-full !py-2" disabled>Add payment method</button>
            <p className="mt-2 text-[11px] muted text-center">Available once a payment provider is connected.</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-bold">Plans</h2>
        <p className="muted text-sm mt-1">Upgrade or downgrade anytime. Downgrades keep your current period.</p>
        <div className="mt-8"><PricingCards /></div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Billing history</h2>
        {history.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-white/15 p-6 text-sm muted text-center">No invoices yet. Invoices will appear here once billing is connected.</div>
        ) : (
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {history.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-medium">{e.type.replace(/^mock\./, "").replace(/\./g, " · ").replace(/_/g, " ")}</div>
                  <div className="text-xs muted">{e.payload?.from ? `${e.payload.from} → ${e.payload.to}` : e.payload?.planId || e.payload?.plan || ""}{e.provider === "mock" ? " · mock (no charge)" : ""}</div>
                </div>
                <span className="text-xs muted">{formatDate(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
