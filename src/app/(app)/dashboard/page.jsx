"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import UsageWidget from "@/components/UsageWidget";
import PodcastCard, { EmptyState } from "@/components/PodcastCard";
import PremiumFeatureLock from "@/components/PremiumFeatureLock";

export default function Dashboard() {
  const { user, plan, handleError, refresh, system } = useApp();
  const [podcasts, setPodcasts] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => api("/api/podcasts?limit=6").then((r) => alive && setPodcasts(r.podcasts)).catch(handleError);
    load();
    const t = setInterval(() => {
      if (podcasts?.some((p) => p.status === "processing" || p.status === "queued")) {
        load();
        refresh();
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podcasts?.some((p) => p.status === "processing" || p.status === "queued")]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Hi, {user.name?.split(" ")[0] || "there"} 👋</h1>
          <p className="mt-1 muted">Turn your next document into something worth listening to.</p>
        </div>
        <Link href="/podcasts/new" className="btn btn-primary">＋ Create Podcast</Link>
      </div>

      {system && (system.tts === "mock" || system.ai === "mock") && (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 px-4 py-3 text-xs text-sky-100">
          Development mode: {system.ai === "mock" ? "AI script writer is running in mock mode (no GEMINI_API_KEY or OPENROUTER_API_KEY)" : ""}{system.ai === "mock" && system.tts === "mock" ? " and " : ""}{system.tts === "mock" ? "The voice provider is offline, so placeholder audio is synthesized" : ""}. Real output requires a configured AI/TTS provider{!system.ffmpeg ? " + FFmpeg for MP3" : ""}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><UsageWidget /></div>
        <div className="card p-5">
          <div className="text-sm font-semibold">Quick actions</div>
          <div className="mt-3 grid gap-2">
            <Link href="/podcasts/new" className="btn btn-secondary justify-start">⚡ Quick Summary</Link>
            <PremiumFeatureLock plan="PRO" feature="two AI hosts" reason="Upgrade to unlock two AI hosts">
              <Link href="/podcasts/new?style=two_hosts" className="btn btn-secondary justify-start w-full">🎙️ Two Hosts</Link>
            </PremiumFeatureLock>
            <PremiumFeatureLock plan="CREATOR" feature="batch processing" reason="Batch PDF processing is available on the Creator plan.">
              <Link href="/podcasts/new?batch=1" className="btn btn-secondary justify-start w-full">📚 Batch PDFs</Link>
            </PremiumFeatureLock>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Podcasts</h2>
          <Link href="/podcasts" className="text-sm muted hover:text-white">View all →</Link>
        </div>
        <div className="mt-4 grid gap-3">
          {podcasts === null && [0, 1, 2].map((i) => <div key={i} className="card h-24 animate-pulse" />)}
          {podcasts?.length === 0 && <EmptyState />}
          {podcasts?.map((p, i) => <PodcastCard key={p.id} podcast={p} index={i} />)}
        </div>
      </section>
      {plan === "FREE" && podcasts?.length > 0 && (
        <div className="card flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-violet-400/20">
          <div>
            <div className="font-semibold">Enjoying PodMind?</div>
            <p className="text-sm muted">Pro adds two hosts, Deep Dive, Study Mode, downloads and 500 audio minutes a month.</p>
          </div>
          <Link href="/settings/billing" className="btn btn-primary shrink-0">See Pro</Link>
        </div>
      )}
    </div>
  );
}
