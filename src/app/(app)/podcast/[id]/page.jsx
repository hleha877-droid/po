"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { useApp } from "@/components/AppProvider";
import AudioPlayer from "@/components/AudioPlayer";
import GenerationProgress from "@/components/GenerationProgress";
import PremiumFeatureLock from "@/components/PremiumFeatureLock";
import { Cover, StatusPill } from "@/components/PodcastCard";
import { Spinner, Field } from "@/components/ui";

export default function PodcastPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, plan, handleError, toast, refresh, openUpgrade, system } = useApp();
  const [p, setP] = useState(null);
  const [draft, setDraft] = useState(null); // { title, description, lines }
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [copied, setCopied] = useState(false);
  const coverInput = useRef(null);
  const startedAt = useRef(Date.now());

  const load = async () => {
    try {
      const r = await api(`/api/podcasts/${id}`);
      setP(r.podcast);
      if (!draft || r.podcast.status === "completed") setDraft((d) => d && dirty(d, r.podcast) ? d : { title: r.podcast.title, description: r.podcast.description, lines: r.podcast.script?.lines || [] });
    } catch (e) {
      handleError(e);
      if (e.status === 404) router.replace("/podcasts");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => {
    if (!p || (p.status !== "processing" && p.status !== "queued")) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.status]);

  if (!p || !draft) return <div className="card h-64 animate-pulse" />;
  const perms = p.permissions || {};
  const busy = p.status === "processing" || p.status === "queued";
  const isDirty = dirty(draft, p);

  async function save() {
    setSaving(true);
    try {
      const body = { title: draft.title, description: draft.description };
      if (perms.editScript && JSON.stringify(draft.lines) !== JSON.stringify(p.script?.lines)) body.lines = draft.lines;
      const r = await api(`/api/podcasts/${id}`, { method: "PATCH", body });
      setP(r.podcast);
      setDraft({ title: r.podcast.title, description: r.podcast.description, lines: r.podcast.script?.lines || [] });
      toast("Saved.", "success");
    } catch (e) {
      handleError(e);
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (isDirty) await save();
    setRegenerating(true);
    try {
      const r = await api(`/api/podcasts/${id}/regenerate-audio`, { method: "POST", body: {} });
      startedAt.current = Date.now();
      setP(r.podcast);
      toast("Regenerating audio from your script — the AI writer is not called again.", "info");
    } catch (e) {
      handleError(e);
    } finally {
      setRegenerating(false);
    }
  }

  async function setVisibility(v) {
    try {
      const r = await api(`/api/podcasts/${id}`, { method: "PATCH", body: { visibility: v } });
      setP(r.podcast);
      toast(v === "public" ? "Your podcast is now public." : "Your podcast is private again.", "success");
    } catch (e) {
      handleError(e);
    }
  }

  async function uploadCover(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast("Cover must be PNG, JPG or WEBP.", "error");
    if (file.size > 5 * 1024 * 1024) return toast("Cover must be 5MB or smaller.", "error");
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("cover", file);
      const r = await api(`/api/podcasts/${id}/cover`, { method: "POST", formData: fd });
      setP(r.podcast);
      toast("Cover updated.", "success");
    } catch (e) {
      handleError(e);
    } finally {
      setUploadingCover(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this podcast? This cannot be undone.")) return;
    try {
      await api(`/api/podcasts/${id}`, { method: "DELETE" });
      refresh();
      router.replace("/podcasts");
    } catch (e) {
      handleError(e);
    }
  }

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/listen/${p.id}` : `/listen/${p.id}`;
  const copy = () => navigator.clipboard.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });

  const downloadSlot = perms.download ? (
    <a href={`/api/podcasts/${id}/download`} className="btn btn-secondary w-full sm:w-auto">⤓ Download {p.audioFormat === "wav" ? "WAV" : "MP3"}</a>
  ) : (
    <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={() => openUpgrade({ reason: "Upgrade to Pro to download your podcasts.", requiredPlan: "PRO", feature: "downloads" })}>🔒 MP3 Download</button>
  );

  return (
    <div className="space-y-6">
      <Link href="/podcasts" className="text-sm muted hover:text-white">← My Podcasts</Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="relative group self-start">
          <Cover podcast={p} className="h-32 w-32 sm:h-40 sm:w-40" rounded="rounded-3xl" />
          {perms.customCover ? (
            <>
              <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadCover(e.target.files?.[0])} />
              <button onClick={() => coverInput.current?.click()} className="absolute inset-0 rounded-3xl bg-black/50 opacity-0 group-hover:opacity-100 transition text-xs font-medium flex items-center justify-center">{uploadingCover ? <Spinner /> : "Change cover"}</button>
            </>
          ) : (
            <button onClick={() => openUpgrade({ reason: "Custom podcast covers are available on the Pro plan.", requiredPlan: "PRO", feature: "customCover" })} className="absolute bottom-2 right-2 badge badge-pro">🔒 Pro</button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={p.status} stageLabel={p.stageLabel} />
            <span className="text-xs muted">{p.styleName} · {p.lengthName} · {p.language.toUpperCase()}</span>
            {p.visibility === "public" && <span className="text-xs text-cyan-300">Public</span>}
          </div>
          <input className="mt-2 w-full bg-transparent text-2xl sm:text-3xl font-bold outline-none border-b border-transparent focus:border-violet-400/50" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea className="mt-2 w-full bg-transparent text-sm muted outline-none resize-none border-b border-transparent focus:border-violet-400/50" rows={2} placeholder="Add a description…" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs muted">
            <span>📄 {p.sourceFileName} · {p.sourcePages} pages</span>
            <span>{formatDate(p.createdAt)}</span>
            {p.audioDurationSeconds > 0 && <span>{formatDuration(p.audioDurationSeconds)} · {formatBytes(p.fileSize)}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {isDirty && <button className="btn btn-primary !py-2" onClick={save} disabled={saving}>{saving && <Spinner />} Save changes</button>}
            {p.status !== "processing" && p.status !== "queued" && p.script?.lines?.length > 0 && (
              perms.regenerateAudio ? (
                <button className="btn btn-secondary !py-2" onClick={regenerate} disabled={regenerating}>{regenerating ? <Spinner /> : "🔁"} Regenerate Audio</button>
              ) : (
                <button className="btn btn-secondary !py-2" onClick={() => openUpgrade({ reason: "Regenerating audio and editing the script are Pro features.", requiredPlan: "PRO", feature: "regenerateAudio" })}>🔒 Regenerate Audio</button>
              )
            )}
            <button className="btn btn-danger !py-2 ml-auto" onClick={remove}>Delete</button>
          </div>
        </div>
      </div>

      {busy && <GenerationProgress podcast={p} startedAt={startedAt.current} />}

      {p.status === "failed" && (
        <div className="card p-5 border-rose-400/30">
          <div className="font-semibold text-rose-200">Generation failed</div>
          <p className="mt-1 text-sm muted">{p.statusMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(p.errorCode || "").includes("LIMIT") && <button className="btn btn-primary" onClick={() => openUpgrade({ reason: p.statusMessage })}>Upgrade plan</button>}
            {p.script?.lines?.length > 0 && perms.regenerateAudio && <button className="btn btn-secondary" onClick={regenerate}>Retry audio</button>}
            <Link href="/podcasts/new" className="btn btn-secondary">Create another</Link>
          </div>
        </div>
      )}

      {p.status === "completed" && p.audioUrl && (
        <>
          <AudioPlayer src={p.audioUrl} duration={p.audioDurationSeconds} title={p.title} downloadSlot={downloadSlot} initialSpeed={Number(user?.preferences?.playbackSpeed) || 1} />
          {p.script?.ttsProvider === "mock" && (
            <div className="text-xs muted -mt-3">Placeholder audio (mock TTS). Connect the Silero service to hear real voices.</div>
          )}
        </>
      )}

      {/* Sharing */}
      <section className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Sharing</div>
            <p className="text-sm muted">{p.visibility === "public" ? "Anyone with the link can listen." : "Only you can access this podcast."}</p>
          </div>
          {perms.publicSharing ? (
            <div className="flex gap-1 rounded-xl bg-white/5 p-1">
              {["private", "public"].map((v) => (
                <button key={v} disabled={p.status !== "completed"} onClick={() => setVisibility(v)} className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${p.visibility === v ? "bg-white/15 text-white" : "muted hover:text-white"}`}>{v}</button>
              ))}
            </div>
          ) : (
            <PremiumFeatureLock inline plan="PRO" feature="public podcast pages" reason="Public podcast links are available on the Pro plan." />
          )}
        </div>
        {p.visibility === "public" && (
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input readOnly className="input font-mono text-xs" value={publicUrl} onFocus={(e) => e.target.select()} />
            <button className="btn btn-secondary" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
            <a className="btn btn-ghost" href={`/listen/${p.id}`} target="_blank" rel="noreferrer">Open ↗</a>
          </div>
        )}
      </section>

      {/* Script editor / transcript */}
      {draft.lines.length > 0 && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{perms.editScript ? "Script editor" : "Transcript"}</div>
              <p className="text-xs muted">{perms.editScript ? "Edit any line, then Regenerate Audio. The AI writer is not called again — only the voices." : "Basic transcript. Upgrade to Pro to edit the script and export it."}</p>
            </div>
            <div className="flex items-center gap-2">
              {perms.fullTranscript ? (
                <a href={`/api/podcasts/${id}/transcript`} className="btn btn-ghost !py-1.5 !text-xs">Export .txt</a>
              ) : (
                <PremiumFeatureLock inline plan="PRO" feature="script editing and transcript export" />
              )}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {draft.lines.map((line, i) => (
              <div key={i} className="flex gap-3">
                <div className="shrink-0 pt-2">
                  {perms.editScript ? (
                    <button type="button" onClick={() => setDraft({ ...draft, lines: draft.lines.map((l, j) => (j === i ? { ...l, speaker: l.speaker === "HOST_1" ? "HOST_2" : "HOST_1" } : l)) })} className={`badge ${line.speaker === "HOST_2" ? "!bg-cyan-400/15 !text-cyan-200" : "!bg-violet-400/15 !text-violet-200"} !normal-case`} title="Switch speaker">
                      {line.speaker === "HOST_2" ? "Host 2" : "Host 1"}
                    </button>
                  ) : (
                    <span className={`badge ${line.speaker === "HOST_2" ? "!bg-cyan-400/15 !text-cyan-200" : "!bg-violet-400/15 !text-violet-200"} !normal-case`}>{line.speaker === "HOST_2" ? "Host 2" : "Host 1"}</span>
                  )}
                </div>
                {perms.editScript ? (
                  <textarea className="input !py-2 min-h-[44px] resize-y" rows={Math.max(1, Math.ceil(line.text.length / 110))} value={line.text} onChange={(e) => setDraft({ ...draft, lines: draft.lines.map((l, j) => (j === i ? { ...l, text: e.target.value } : l)) })} />
                ) : (
                  <p className="text-sm leading-relaxed pt-1.5">{line.text}</p>
                )}
                {perms.editScript && <button type="button" className="muted hover:text-rose-300 text-xs pt-2" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, j) => j !== i) })} title="Remove line">✕</button>}
              </div>
            ))}
          </div>
          {perms.editScript && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost !text-xs" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { speaker: "HOST_1", text: "" }] })}>＋ Add line</button>
              {isDirty && <button className="btn btn-primary !py-2 ml-auto" onClick={save} disabled={saving}>{saving && <Spinner />} Save script</button>}
              {isDirty && <button className="btn btn-secondary !py-2" onClick={regenerate} disabled={regenerating || busy}>Save & Regenerate Audio</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function dirty(draft, p) {
  if (!draft || !p) return false;
  return draft.title !== p.title || draft.description !== p.description || JSON.stringify(draft.lines) !== JSON.stringify(p.script?.lines || []);
}
