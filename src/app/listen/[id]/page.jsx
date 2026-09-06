"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import AudioPlayer from "@/components/AudioPlayer";
import { Cover } from "@/components/PodcastCard";
import { Logo } from "@/components/ui";
import { formatDate, formatDuration } from "@/lib/format";

export default function ListenPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api(`/api/listen/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <Logo className="text-xl" />
        <h1 className="mt-8 text-2xl font-bold">This podcast isn't available</h1>
        <p className="mt-2 muted">{error}</p>
        <Link href="/" className="btn btn-primary mt-6">Make your own with PodMind</Link>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" /></div>;
  const { podcast: p, author, branding, watermark } = data;
  const accent = branding?.color || null;
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          {branding?.name ? <span className="font-bold" style={accent ? { color: accent } : undefined}>{branding.name}</span> : <Link href="/"><Logo /></Link>}
          <Link href="/register" className="btn btn-secondary !py-2 !text-xs">Create your own</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-col sm:flex-row gap-6">
          <Cover podcast={p} className="h-40 w-40 sm:h-48 sm:w-48" rounded="rounded-3xl" />
          <div className="min-w-0">
            <div className="text-xs muted uppercase tracking-wide">{p.styleName} · {p.language.toUpperCase()} · {formatDuration(p.audioDurationSeconds)}</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{p.title}</h1>
            <p className="mt-3 muted">{p.description}</p>
            <div className="mt-3 text-xs muted">By {author} · {formatDate(p.createdAt)}</div>
          </div>
        </div>
        <div className="mt-8"><AudioPlayer src={p.audioUrl} duration={p.audioDurationSeconds} /></div>
        {p.script?.lines?.length > 0 && (
          <section className="card mt-8 p-5">
            <h2 className="font-semibold">Transcript</h2>
            <div className="mt-4 space-y-3">
              {p.script.lines.map((l, i) => (
                <p key={i} className="text-sm leading-relaxed">
                  <span className={`font-semibold ${l.speaker === "HOST_2" ? "text-cyan-300" : "text-violet-300"}`}>{l.speaker === "HOST_2" ? "Host 2" : "Host 1"}: </span>{l.text}
                </p>
              ))}
            </div>
          </section>
        )}
        <footer className="mt-12 text-center text-sm muted">
          {watermark || !branding ? <>Made with <Link href="/" className="text-violet-300 hover:text-white font-semibold">PodMind AI</Link> — turn any PDF into a podcast.</> : <span>Powered by PodMind AI</span>}
        </footer>
      </main>
    </div>
  );
}
