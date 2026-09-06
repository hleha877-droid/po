"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import UsageWidget from "@/components/UsageWidget";
import PremiumFeatureLock, { planAtLeast } from "@/components/PremiumFeatureLock";
import { Field, Spinner, PlanBadge } from "@/components/ui";

function Section({ title, description, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-semibold text-lg">{title}</h2>
      {description && <p className="mt-1 text-sm muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, setUser, plan, planConfig, plans, toast, handleError, system, refresh } = useApp();
  const [profile, setProfile] = useState({ name: user?.name || "", avatarUrl: user?.avatarUrl || "" });
  const [prefs, setPrefs] = useState({ defaultLanguage: "ru", defaultVoiceHost1: "aidar", defaultVoiceHost2: "kseniya", defaultStyle: "quick_summary", defaultLength: "quick", playbackSpeed: 1, theme: "dark", notifications: true, brandName: "", brandColor: "#7c6cff", ...(user?.preferences || {}) });
  const [voices, setVoices] = useState([]);
  const [saving, setSaving] = useState(null);
  useEffect(() => { api("/api/voices").then((r) => setVoices(r.voices)).catch(() => {}); }, []);

  async function save(kind, body) {
    setSaving(kind);
    try {
      const r = await api("/api/settings", { method: "PATCH", body });
      setUser(r.user);
      toast("Settings saved.", "success");
    } catch (e) {
      handleError(e);
    } finally {
      setSaving(null);
    }
  }
  const allowed = (key, value) => planAtLeast(plan, (() => { for (const id of ["FREE", "PRO", "CREATOR"]) if (plans?.plans[id][key].includes(value)) return id; return "CREATOR"; })());
  const langVoices = voices.filter((v) => v.language === prefs.defaultLanguage);

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>

      <Section title="Profile" description="How you appear in PodMind and on public podcast pages.">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-xl font-bold">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : (profile.name || user.email)[0]?.toUpperCase()}
          </div>
          <div className="flex-1 grid gap-4">
            <Field label="Name"><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Email"><input className="input opacity-60" value={user.email} readOnly /></Field>
            <Field label="Avatar URL" hint="Paste a link to an image."><input className="input" value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} placeholder="https://…" /></Field>
            <div><button className="btn btn-primary" onClick={() => save("profile", profile)} disabled={saving === "profile"}>{saving === "profile" && <Spinner />} Save profile</button></div>
          </div>
        </div>
      </Section>

      <Section title="Subscription">
        <UsageWidget />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="muted">You're on <b>{planConfig?.name}</b> <PlanBadge plan={plan} /></span>
          <Link href="/settings/billing" className="btn btn-secondary !py-2">Manage billing & plans</Link>
        </div>
      </Section>

      <Section title="Audio" description="Defaults for new podcasts and playback.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default language">
            <select className="input" value={prefs.defaultLanguage} onChange={(e) => setPrefs({ ...prefs, defaultLanguage: e.target.value })}>
              {plans && Object.values(plans.languages).map((l) => <option key={l.id} value={l.id} disabled={!allowed("availableLanguages", l.id)}>{l.flag} {l.name}{!allowed("availableLanguages", l.id) ? " (Pro)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Default podcast style">
            <select className="input" value={prefs.defaultStyle} onChange={(e) => setPrefs({ ...prefs, defaultStyle: e.target.value })}>
              {plans && Object.values(plans.styles).map((s) => <option key={s.id} value={s.id} disabled={!allowed("availableStyles", s.id)}>{s.name}{!allowed("availableStyles", s.id) ? " (Pro)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Default voice · Host 1">
            <select className="input" value={prefs.defaultVoiceHost1} onChange={(e) => setPrefs({ ...prefs, defaultVoiceHost1: e.target.value })}>
              {langVoices.map((v) => <option key={v.id} value={v.id} disabled={!planAtLeast(plan, v.requiredPlan)}>{v.name} ({v.gender}){!planAtLeast(plan, v.requiredPlan) ? " (Pro)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Default voice · Host 2">
            <select className="input" value={prefs.defaultVoiceHost2} onChange={(e) => setPrefs({ ...prefs, defaultVoiceHost2: e.target.value })}>
              {langVoices.map((v) => <option key={v.id} value={v.id} disabled={!planAtLeast(plan, v.requiredPlan)}>{v.name} ({v.gender}){!planAtLeast(plan, v.requiredPlan) ? " (Pro)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Default length">
            <select className="input" value={prefs.defaultLength} onChange={(e) => setPrefs({ ...prefs, defaultLength: e.target.value })}>
              {plans && Object.values(plans.lengths).map((l) => <option key={l.id} value={l.id} disabled={!allowed("availableLengths", l.id)}>{l.name} · {l.range}</option>)}
            </select>
          </Field>
          <Field label="Playback speed">
            <select className="input" value={prefs.playbackSpeed} onChange={(e) => setPrefs({ ...prefs, playbackSpeed: Number(e.target.value) })}>
              {[0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s}>{s}x</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4"><button className="btn btn-primary" onClick={() => save("audio", { preferences: prefs })} disabled={saving === "audio"}>{saving === "audio" && <Spinner />} Save audio defaults</button></div>
      </Section>

      <Section title="Preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Theme">
            <select className="input" value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Field>
          <Field label="Notifications">
            <label className="flex items-center gap-3 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={Boolean(prefs.notifications)} onChange={(e) => setPrefs({ ...prefs, notifications: e.target.checked })} />
              Email me when a podcast is ready
            </label>
          </Field>
        </div>
        <div className="mt-5">
          <div className="text-sm font-medium mb-2">Public page branding <span className="badge badge-creator ml-1">Creator</span></div>
          <PremiumFeatureLock plan="CREATOR" feature="custom branding" reason="Custom branding on public podcast pages is a Creator feature.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand name"><input className="input" value={prefs.brandName} onChange={(e) => setPrefs({ ...prefs, brandName: e.target.value })} placeholder="Your show or company" /></Field>
              <Field label="Accent color"><input className="input h-[42px]" type="color" value={prefs.brandColor} onChange={(e) => setPrefs({ ...prefs, brandColor: e.target.value })} /></Field>
            </div>
          </PremiumFeatureLock>
        </div>
        <div className="mt-4"><button className="btn btn-primary" onClick={() => save("prefs", { preferences: prefs })} disabled={saving === "prefs"}>{saving === "prefs" && <Spinner />} Save preferences</button></div>
      </Section>

      {system?.devTools && (
        <Section title="Developer tools" description="Only available outside production.">
          <button className="btn btn-secondary" onClick={async () => { try { await api("/api/dev/reset-usage", { method: "POST" }); await refresh(); toast("Usage reset for this month.", "success"); } catch (e) { handleError(e); } }}>Reset my usage</button>
        </Section>
      )}
    </div>
  );
}
