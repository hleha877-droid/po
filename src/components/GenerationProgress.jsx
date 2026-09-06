"use client";
import { motion } from "framer-motion";

export const STAGES = [
  { id: "uploading", label: "Uploading" },
  { id: "extracting", label: "Extracting document" },
  { id: "understanding", label: "Understanding content" },
  { id: "writing", label: "Writing podcast" },
  { id: "preparing_voices", label: "Preparing voices" },
  { id: "generating_audio", label: "Generating audio" },
  { id: "combining", label: "Combining audio" },
  { id: "finishing", label: "Finishing" },
];

export function Waveform({ active = true, bars = 28, className = "" }) {
  return (
    <div className={`flex items-center justify-center gap-[3px] h-14 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className={`w-1.5 rounded-full bg-gradient-to-t from-violet-500 via-indigo-400 to-cyan-300 ${active ? "wave-bar" : ""}`} style={{ height: `${(25 + Math.abs(Math.sin(i * 0.8)) * 75).toFixed(4)}%`, animationDelay: `${(i % 9) * 0.1}s`, animationDuration: `${0.9 + (i % 4) * 0.15}s` }} />
      ))}
    </div>
  );
}

export default function GenerationProgress({ podcast, startedAt }) {
  const idx = Math.max(0, STAGES.findIndex((s) => s.id === podcast.stage));
  const progress = podcast.status === "queued" ? 3 : podcast.progress || 0;
  const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const eta = progress > 8 && elapsed > 3 ? Math.max(0, Math.round((elapsed / progress) * (100 - progress))) : null;
  return (
    <div className="glass-strong rounded-3xl p-6 sm:p-8">
      <Waveform active={podcast.status !== "failed"} />
      <div className="mt-4 text-center">
        <div className="text-2xl font-bold tabular-nums">{progress}%</div>
        <div className="mt-1 text-sm text-violet-200">{podcast.statusMessage || podcast.stageLabel}</div>
        {podcast.status === "queued" && podcast.queuePosition > 1 && <div className="mt-1 text-xs muted">Position in queue: {podcast.queuePosition}</div>}
        {eta !== null && podcast.status === "processing" && <div className="mt-1 text-xs muted">About {eta < 60 ? `${eta}s` : `${Math.ceil(eta / 60)} min`} remaining</div>}
      </div>
      <div className="progress mt-5"><motion.div animate={{ width: `${progress}%` }} transition={{ ease: "easeOut", duration: 0.6 }} /></div>
      <ol className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STAGES.map((s, i) => {
          const done = i < idx || podcast.status === "completed";
          const current = i === idx && podcast.status === "processing";
          return (
            <li key={s.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${current ? "bg-violet-500/15 text-white" : done ? "text-emerald-300" : "muted"}`}>
              <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${done ? "bg-emerald-400/20" : current ? "bg-violet-400/30 animate-pulse" : "bg-white/5"}`}>{done ? "✓" : i + 1}</span>
              <span className="truncate">{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
