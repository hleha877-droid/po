"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { defaultCoverStyle, formatDate, formatMinutes } from "@/lib/format";

export function Cover({ podcast, className = "h-16 w-16", rounded = "rounded-xl" }) {
  return (
    <div className={`${className} ${rounded} shrink-0 overflow-hidden relative`} style={podcast.coverUrl ? undefined : defaultCoverStyle(podcast.id)}>
      {podcast.coverUrl ? <img src={podcast.coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-white/80 text-xl">♫</div>}
    </div>
  );
}

export function StatusPill({ status, stageLabel }) {
  const map = {
    completed: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    processing: "bg-violet-400/15 text-violet-200 border-violet-400/30",
    queued: "bg-sky-400/15 text-sky-200 border-sky-400/30",
    failed: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  };
  const label = status === "processing" ? stageLabel || "Processing" : status === "queued" ? "Waiting" : status === "completed" ? "Completed" : "Failed";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status] || map.queued}`}>{status === "processing" && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}{label}</span>;
}

export default function PodcastCard({ podcast, index = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link href={`/podcast/${podcast.id}`} className="card flex gap-4 p-4 transition hover:bg-white/[0.06] group">
        <Cover podcast={podcast} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold group-hover:text-white">{podcast.title}</h3>
            <StatusPill status={podcast.status} stageLabel={podcast.stageLabel} />
          </div>
          <div className="mt-0.5 truncate text-xs muted">📄 {podcast.sourceFileName}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs muted">
            <span>{formatDate(podcast.createdAt)}</span>
            <span>·</span>
            <span>{podcast.status === "completed" ? formatMinutes(podcast.audioDurationSeconds) : podcast.estimatedMinutes ? `~${Math.round(podcast.estimatedMinutes)} min` : "—"}</span>
            <span>·</span>
            <span>{podcast.styleName}</span>
            {podcast.visibility === "public" && <span className="text-cyan-300">· Public</span>}
          </div>
          {podcast.status === "processing" && (
            <div className="progress mt-2"><div style={{ width: `${podcast.progress}%` }} /></div>
          )}
        </div>
        <div className="hidden sm:flex items-center">
          <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${podcast.status === "completed" ? "bg-gradient-to-br from-violet-500 to-cyan-400 text-white" : "bg-white/5 muted"}`}>▶</span>
        </div>
      </Link>
    </motion.div>
  );
}

export function EmptyState({ title = "No podcasts yet.", subtitle = "Upload your first PDF and turn it into a conversation.", cta = "Create Podcast", href = "/podcasts/new" }) {
  return (
    <div className="card relative overflow-hidden p-10 text-center">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-400/30 text-3xl">🎙️</div>
      <h3 className="relative mt-5 text-xl font-semibold">{title}</h3>
      <p className="relative mt-2 text-sm muted max-w-sm mx-auto">{subtitle}</p>
      {href && <Link href={href} className="btn btn-primary relative mt-6">{cta}</Link>}
    </div>
  );
}
