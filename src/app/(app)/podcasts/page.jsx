"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApp } from "@/components/AppProvider";
import PodcastCard, { EmptyState } from "@/components/PodcastCard";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "processing", label: "Processing" },
  { id: "failed", label: "Failed" },
];

export default function PodcastsPage() {
  const { handleError } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/api/podcasts?q=${encodeURIComponent(q)}&status=${filter}`).then((r) => setItems(r.podcasts)).catch(handleError);
    }, 250);
    return () => clearTimeout(t);
  }, [q, filter, handleError]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">My Podcasts</h1>
        <Link href="/podcasts/new" className="btn btn-primary">＋ Create Podcast</Link>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input className="input sm:max-w-sm" placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1 rounded-xl bg-white/5 p-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition ${filter === f.id ? "bg-white/15 text-white" : "muted hover:text-white"}`}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        {items === null && [0, 1, 2, 3].map((i) => <div key={i} className="card h-24 animate-pulse" />)}
        {items?.length === 0 && (q || filter !== "all" ? (
          <EmptyState title="Nothing matches." subtitle="Try a different search or filter." cta="Clear filters" href={null} />
        ) : (
          <EmptyState />
        ))}
        {items?.map((p, i) => <PodcastCard key={p.id} podcast={p} index={i} />)}
      </div>
    </div>
  );
}
