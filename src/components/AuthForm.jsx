"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { Logo, Spinner, Field } from "./ui";

function Inner({ mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh, toast } = useApp();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targetPlan = params.get("plan");
  const next = params.get("next") || "/dashboard";

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: form });
      await refresh();
      if (targetPlan && targetPlan !== "FREE") {
        try {
          const res = await api("/api/billing/checkout", { method: "POST", body: { planId: targetPlan } });
          if (res.checkout?.url) return (window.location.href = res.checkout.url);
          await refresh();
          toast(`Welcome! You're on the ${targetPlan} plan.`, "success");
        } catch (err) {
          toast(err.message, "error", "Billing");
        }
      }
      router.replace(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center"><Logo className="text-xl" /></Link>
        <div className="glass-strong mt-8 rounded-3xl p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm muted">{mode === "login" ? "Sign in to your PodMind studio." : targetPlan && targetPlan !== "FREE" ? `You'll continue to the ${targetPlan} plan after signing up.` : "Start with 3 free podcasts every month."}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></Field>
            )}
            <Field label="Email"><input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></Field>
            <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}><input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></Field>
            {error && <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
            <button className="btn btn-primary w-full py-3" disabled={busy}>{busy && <Spinner />}{mode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="mt-5 text-center text-sm muted">
            {mode === "login" ? (<>New here? <Link href="/register" className="text-violet-300 hover:text-white">Create an account</Link></>) : (<>Already have an account? <Link href="/login" className="text-violet-300 hover:text-white">Sign in</Link></>)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthForm({ mode }) {
  return <Suspense fallback={null}><Inner mode={mode} /></Suspense>;
}
