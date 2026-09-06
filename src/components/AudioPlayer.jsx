"use client";
import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayer({ src, duration: knownDuration = 0, downloadSlot, initialSpeed = 1, title }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(knownDuration);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(initialSpeed);
  const [buffering, setBuffering] = useState(false);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => Number.isFinite(a.duration) && setDuration(a.duration);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("waiting", () => setBuffering(true));
    a.addEventListener("playing", () => setBuffering(false));
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };
  const seek = (v) => {
    if (audio.current) audio.current.currentTime = v;
    setTime(v);
  };
  const skip = (d) => seek(Math.max(0, Math.min(duration || 0, time + d)));
  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div className="glass-strong rounded-3xl p-4 sm:p-6">
      <audio ref={audio} src={src} preload="metadata" />
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-end gap-[3px] h-6">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className={`w-1 rounded-full bg-gradient-to-t from-violet-500 to-cyan-400 ${playing ? "wave-bar" : ""}`} style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 7) * 0.12}s`, transform: playing ? undefined : "scaleY(0.35)" }} />
          ))}
        </div>
        {title && <div className="truncate text-sm font-medium ml-2">{title}</div>}
      </div>
      <div className="group relative">
        <input type="range" min={0} max={duration || 0} step={0.1} value={Math.min(time, duration || 0)} onChange={(e) => seek(Number(e.target.value))} className="absolute inset-0 z-10 w-full opacity-0 cursor-pointer" aria-label="Seek" />
        <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 relative" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums muted">
        <span>{formatDuration(time)}</span>
        <span>{formatDuration(duration)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost !px-2.5" onClick={() => skip(-15)} aria-label="Back 15s">↺15</button>
          <button onClick={toggle} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-lg shadow-violet-500/40 hover:scale-105 transition" aria-label={playing ? "Pause" : "Play"}>
            {buffering ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : playing ? "❚❚" : <span className="ml-0.5">▶</span>}
          </button>
          <button className="btn btn-ghost !px-2.5" onClick={() => skip(30)} aria-label="Forward 30s">30↻</button>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`rounded-lg px-2 py-1 text-xs font-medium transition ${speed === s ? "bg-white/15 text-white" : "muted hover:text-white"}`}>{s}x</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button className="text-sm muted" onClick={() => setVolume(volume ? 0 : 1)} aria-label="Mute">{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</button>
          <input type="range" min={0} max={1} step={0.02} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-20 sm:w-24" aria-label="Volume" />
        </div>
        {downloadSlot && <div className="w-full sm:w-auto">{downloadSlot}</div>}
      </div>
    </div>
  );
}
