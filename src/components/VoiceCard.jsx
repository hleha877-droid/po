"use client";
import { useRef, useState } from "react";
import PremiumFeatureLock, { planAtLeast } from "./PremiumFeatureLock";
import { useApp } from "./AppProvider";

export default function VoiceCard({ voice, selected, onSelect }) {
  const { plan } = useApp();
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const locked = !planAtLeast(plan, voice.requiredPlan || "FREE");
  const preview = (e) => {
    e.stopPropagation();
    if (!audio.current) {
      audio.current = new Audio(`/api/voices/preview?voice=${voice.id}`);
      audio.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audio.current.pause();
      audio.current.currentTime = 0;
      setPlaying(false);
    } else {
      audio.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };
  const card = (
    <button type="button" onClick={() => !locked && onSelect(voice.id)} className={`w-full text-left rounded-2xl border p-3.5 transition ${selected ? "border-violet-400/60 bg-violet-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-lg ${voice.gender === "female" ? "bg-pink-400/20" : "bg-sky-400/20"}`}>{voice.gender === "female" ? "👩" : "🧑"}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{voice.name}</span>
            {voice.tier === "premium" && <span className="badge badge-pro !text-[9px]">Premium</span>}
          </div>
          <div className="text-xs muted capitalize">{voice.gender} · {voice.language === "ru" ? "Русский" : "English"}</div>
        </div>
        {!locked && (
          <span onClick={preview} role="button" className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs ${playing ? "bg-violet-500 text-white" : "bg-white/10 hover:bg-white/20"}`} title="Preview">{playing ? "■" : "▶"}</span>
        )}
      </div>
    </button>
  );
  if (locked) return <PremiumFeatureLock plan={voice.requiredPlan} feature={`the ${voice.name} voice`} reason={`${voice.name} is a premium voice. Upgrade to ${voice.requiredPlan === "CREATOR" ? "Creator" : "Pro"} to unlock premium voices.`}>{card}</PremiumFeatureLock>;
  return card;
}
