"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { useApp } from "@/components/AppProvider";
import PremiumFeatureLock, { planAtLeast } from "@/components/PremiumFeatureLock";
import VoiceCard from "@/components/VoiceCard";
import GenerationProgress from "@/components/GenerationProgress";
import { Spinner, Field } from "@/components/ui";

const ORDER = ["FREE", "PRO", "CREATOR"];
function minPlanFor(plans, key, value) {
  for (const id of plans.order || ORDER) {
    const values = plans.plans?.[id]?.[key];
    if (Array.isArray(values) && values.includes(value)) return id;
  }
  return "CREATOR";
}

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, plans, plan, planConfig, usage, handleError, refresh, toast, openUpgrade } = useApp();
  const prefs = user?.preferences || {};
  const [files, setFiles] = useState([]);
  const [style, setStyle] = useState(params.get("style") || prefs.defaultStyle || "quick_summary");
  const [length, setLength] = useState(prefs.defaultLength || "quick");
  const [language, setLanguage] = useState(prefs.defaultLanguage || "ru");
  const [voices, setVoices] = useState([]);
  const [voiceHost1, setVoiceHost1] = useState(prefs.defaultVoiceHost1 || "aidar");
  const [voiceHost2, setVoiceHost2] = useState(prefs.defaultVoiceHost2 || "kseniya");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // array of podcasts being generated
  const [startedAt, setStartedAt] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    api("/api/voices").then((r) => setVoices(r.voices)).catch(() => {});
  }, []);

  // Preferences can outlive a plan downgrade, so keep the form on allowed options.
  useEffect(() => {
    if (!planConfig) return;
    if (!planConfig.availableStyles.includes(style)) setStyle(planConfig.availableStyles[0]);
    if (!planConfig.availableLengths.includes(length)) setLength(planConfig.availableLengths[0]);
    if (!planConfig.availableLanguages.includes(language)) setLanguage(planConfig.availableLanguages[0]);
  }, [planConfig, style, length, language]);

  // Keep voices consistent with the chosen language.
  useEffect(() => {
    if (!planConfig) return;
    const lv = voices.filter((v) => v.language === language);
    if (!lv.length) return;
    if (!planConfig?.availableVoices.includes(voiceHost1)) setVoiceHost1((lv.find((v) => planConfig.availableVoices.includes(v.id) && v.role === "HOST_1") || lv[0]).id);
    if (!planConfig?.availableVoices.includes(voiceHost2)) setVoiceHost2((lv.find((v) => planConfig.availableVoices.includes(v.id) && v.role === "HOST_2") || lv[lv.length - 1]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, voices, planConfig]);

  // Poll status for created podcasts.
  useEffect(() => {
    if (!created?.length) return;
    const t = setInterval(async () => {
      const updated = await Promise.all(created.map((p) => api(`/api/podcasts/${p.id}/status`).then((r) => r.podcast).catch(() => p)));
      setCreated(updated);
      if (updated.every((p) => p.status === "completed" || p.status === "failed")) {
        clearInterval(t);
        refresh();
        if (updated.length === 1 && updated[0].status === "completed") router.push(`/podcast/${updated[0].id}`);
      }
    }, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created?.map((p) => p.id).join(",")]);

  const styles = plans ? Object.values(plans.styles) : [];
  const lengths = plans ? Object.values(plans.lengths) : [];
  const hosts = plans?.styles?.[style]?.hosts || 1;
  const maxBatch = planConfig?.maxBatchSize || 1;
  const langVoices = voices.filter((v) => v.language === language);
  const estimate = useMemo(() => {
    const l = plans?.lengths?.[length];
    return l ? `${l.minMinutes}–${l.maxMinutes} min` : "";
  }, [plans, length]);

  function addFiles(list) {
    const pdfs = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    if (pdfs.length !== list.length) toast("Only PDF files are supported.", "error");
    const merged = [...files, ...pdfs].slice(0, maxBatch);
    if (files.length + pdfs.length > maxBatch) {
      if (maxBatch === 1) openUpgrade({ reason: "Batch PDF processing is available on the Creator plan.", requiredPlan: "CREATOR", feature: "batchProcessing" });
      else toast(`You can process up to ${maxBatch} PDFs at once.`, "error");
    }
    setFiles(merged);
  }

  async function submit(e) {
    e.preventDefault();
    if (!files.length) return toast("Please choose a PDF first.", "error");
    const selectedStyle = planConfig.availableStyles.includes(style) ? style : planConfig.availableStyles[0];
    const selectedLength = planConfig.availableLengths.includes(length) ? length : planConfig.availableLengths[0];
    const selectedLanguage = planConfig.availableLanguages.includes(language) ? language : planConfig.availableLanguages[0];
    const selectedVoiceHost1 = planConfig.availableVoices.includes(voiceHost1) ? voiceHost1 : planConfig.availableVoices[0];
    const selectedVoiceHost2 = planConfig.availableVoices.includes(voiceHost2) ? voiceHost2 : planConfig.availableVoices[0];
    // Friendly client-side pre-checks (backend re-validates everything).
    const tooBig = files.find((f) => f.size > planConfig.maxFileSize);
    if (tooBig) return openUpgrade({ reason: `"${tooBig.name}" is ${formatBytes(tooBig.size)}. Your plan allows up to ${formatBytes(planConfig.maxFileSize)} per PDF.`, requiredPlan: plan === "FREE" ? "PRO" : "CREATOR", code: "PDF_TOO_LARGE" });
    setBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("style", selectedStyle);
      fd.append("length", selectedLength);
      fd.append("language", selectedLanguage);
      fd.append("voiceHost1", selectedVoiceHost1);
      if (plans.styles[selectedStyle]?.hosts === 2) fd.append("voiceHost2", selectedVoiceHost2);
      const res = await api("/api/podcasts", { method: "POST", formData: fd });
      setCreated(res.podcasts);
      setStartedAt(Date.now());
      refresh();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!plans || !planConfig) return <div className="card h-64 animate-pulse" />;

  if (created) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">{created.length > 1 ? "Processing your batch" : "Creating your podcast"}</h1>
        {created.length === 1 ? (
          <>
            <GenerationProgress podcast={created[0]} startedAt={startedAt} />
            {created[0].status === "failed" && (
              <div className="card p-5 border-rose-400/30">
                <div className="font-semibold text-rose-200">Generation failed</div>
                <p className="mt-1 text-sm muted">{created[0].statusMessage}</p>
                <div className="mt-3 flex gap-2">
                  {created[0].errorCode?.includes("LIMIT") && <button className="btn btn-primary" onClick={() => openUpgrade({ reason: created[0].statusMessage })}>Upgrade plan</button>}
                  <button className="btn btn-secondary" onClick={() => setCreated(null)}>Try again</button>
                </div>
              </div>
            )}
            {created[0].status === "completed" && <Link href={`/podcast/${created[0].id}`} className="btn btn-primary w-full">Open podcast →</Link>}
          </>
        ) : (
          <div className="card divide-y divide-white/5">
            {created.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.sourceFileName}</div>
                  <div className="text-xs muted">{p.status === "queued" ? "Waiting" : p.status === "processing" ? `${p.statusMessage} (${p.progress}%)` : p.status === "completed" ? "Completed" : `Failed — ${p.statusMessage}`}</div>
                  {p.status === "processing" && <div className="progress mt-2"><div style={{ width: `${p.progress}%` }} /></div>}
                </div>
                {p.status === "completed" ? <Link href={`/podcast/${p.id}`} className="btn btn-secondary !py-1.5 !text-xs">Open</Link> : p.status === "processing" ? <Spinner /> : <span className="text-xs muted">{p.status === "failed" ? "✕" : "…"}</span>}
              </div>
            ))}
            {created.every((p) => p.status === "completed" || p.status === "failed") && (
              <div className="p-4 flex gap-2"><Link href="/podcasts" className="btn btn-primary">Go to My Podcasts</Link><button className="btn btn-secondary" onClick={() => { setCreated(null); setFiles([]); }}>Create more</button></div>
            )}
          </div>
        )}
      </div>
    );
  }

  const disabledSubmit = busy || !files.length || (usage && (usage.podcasts.percent >= 100 || usage.audioMinutes.percent >= 100));

  return (
    <form onSubmit={submit} className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Create a podcast</h1>
        <p className="mt-1 muted">Upload a PDF and choose how you want to hear it. {usage && <span>You have <b>{usage.podcasts.remaining}</b> podcasts and <b>{usage.audioMinutes.remaining}</b> audio minutes left this month.</span>}</p>
      </div>

      {usage && (usage.podcasts.percent >= 100 || usage.audioMinutes.percent >= 100) && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div><div className="font-semibold">Monthly limit reached</div><div className="text-sm muted">Upgrade to keep creating this month, or wait until your usage resets.</div></div>
          <button type="button" className="btn btn-primary" onClick={() => openUpgrade({ reason: "You've reached your monthly limit." })}>Upgrade plan</button>
        </div>
      )}

      {/* Upload */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">1. Document{maxBatch > 1 ? "s" : ""}</h2>
          <span className="text-xs muted">Up to {planConfig.maxPdfPages} pages · {formatBytes(planConfig.maxFileSize)} per file{maxBatch > 1 ? ` · ${maxBatch} files per batch` : ""}</span>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-violet-400 bg-violet-500/10" : "border-white/15 hover:border-violet-400/50 hover:bg-white/[0.03]"}`}
        >
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple={maxBatch > 1} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div className="text-3xl">📄</div>
          <div className="mt-2 font-medium">Drop your PDF here or click to browse</div>
          <div className="text-xs muted mt-1">{maxBatch > 1 ? "Select multiple PDFs for batch processing." : "One PDF at a time."}</div>
        </div>
        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span>📄</span>
                <span className="truncate flex-1">{f.name}</span>
                <span className={`text-xs ${f.size > planConfig.maxFileSize ? "text-rose-300" : "muted"}`}>{formatBytes(f.size)}</span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="muted hover:text-white">✕</button>
              </li>
            ))}
          </ul>
        )}
        {maxBatch === 1 && (
          <div className="mt-3 text-xs muted flex items-center gap-2">Need to process several PDFs at once? <PremiumFeatureLock inline plan="CREATOR" feature="batch processing" reason="Batch PDF processing is available on the Creator plan." /></div>
        )}
      </section>

      {/* Style */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold">2. Podcast mode</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {styles.map((s) => {
            const required = minPlanFor(plans, "availableStyles", s.id);
            const card = (
              <button type="button" onClick={() => setStyle(s.id)} className={`w-full h-full text-left rounded-2xl border p-4 transition ${style === s.id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="text-2xl">{s.icon}</div>
                <div className="mt-2 font-medium">{s.name}</div>
                <div className="mt-0.5 text-xs muted">{s.description}</div>
              </button>
            );
            return planAtLeast(plan, required) ? <div key={s.id}>{card}</div> : (
              <PremiumFeatureLock key={s.id} plan={required} feature={s.name} reason={s.id === "two_hosts" ? "Upgrade to unlock two AI hosts" : `Upgrade to unlock ${s.name}`}>{card}</PremiumFeatureLock>
            );
          })}
        </div>
      </section>

      {/* Length + language */}
      <section className="card p-5 sm:p-6 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="font-semibold">3. Length <span className="text-xs muted font-normal">· target {estimate}</span></h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {lengths.map((l) => {
              const required = minPlanFor(plans, "availableLengths", l.id);
              const btn = (
                <button type="button" onClick={() => setLength(l.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${length === l.id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs muted">{l.range}</div>
                </button>
              );
              return planAtLeast(plan, required) ? <div key={l.id}>{btn}</div> : <PremiumFeatureLock key={l.id} plan={required} feature={`${l.name} podcasts`}>{btn}</PremiumFeatureLock>;
            })}
          </div>
        </div>
        <div>
          <h2 className="font-semibold">4. Language</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.values(plans.languages).map((l) => {
              const required = minPlanFor(plans, "availableLanguages", l.id);
              const btn = (
                <button type="button" onClick={() => setLanguage(l.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${language === l.id ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <div className="text-sm font-medium">{l.flag} {l.name}</div>
                </button>
              );
              return planAtLeast(plan, required) ? <div key={l.id}>{btn}</div> : <PremiumFeatureLock key={l.id} plan={required} feature="multiple languages">{btn}</PremiumFeatureLock>;
            })}
          </div>
        </div>
      </section>

      {/* Voices */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold">5. Voices</h2>
        <div className={`mt-4 grid gap-6 ${hosts === 2 ? "md:grid-cols-2" : ""}`}>
          <div>
            <div className="text-xs uppercase tracking-wide muted mb-2">Host 1</div>
            <div className="grid gap-2">{langVoices.map((v) => <VoiceCard key={v.id} voice={v} selected={voiceHost1 === v.id} onSelect={setVoiceHost1} />)}</div>
          </div>
          {hosts === 2 && (
            <div>
              <div className="text-xs uppercase tracking-wide muted mb-2">Host 2</div>
              <div className="grid gap-2">{langVoices.map((v) => <VoiceCard key={v.id} voice={v} selected={voiceHost2 === v.id} onSelect={setVoiceHost2} />)}</div>
            </div>
          )}
        </div>
        {!langVoices.length && <div className="text-sm muted">Loading voices…</div>}
      </section>

      <div className="sticky bottom-4 z-10">
        <div className="glass-strong rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs muted">{files.length ? `${files.length} file${files.length > 1 ? "s" : ""} · ${plans.styles[style].name} · ${plans.lengths[length].name} · ${plans.languages[language].name}` : "Choose a PDF to get started."}</div>
          <button className="btn btn-primary w-full sm:w-auto px-6" disabled={disabledSubmit}>{busy ? <><Spinner /> Uploading…</> : "Generate podcast"}</button>
        </div>
      </div>
    </form>
  );
}

export default function CreatePage() {
  return <Suspense fallback={<div className="card h-64 animate-pulse" />}><CreateInner /></Suspense>;
}
