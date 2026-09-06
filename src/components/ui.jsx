"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ProgressBar({ percent = 0, className = "" }) {
  const level = percent >= 100 ? "danger" : percent >= 80 ? "warn" : "";
  return (
    <div className={`progress ${level} ${className}`}>
      <div style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export function PlanBadge({ plan }) {
  const cls = plan === "CREATOR" ? "badge badge-creator" : plan === "PRO" ? "badge badge-pro" : "badge badge-free";
  return <span className={cls}>{plan}</span>;
}

export function Spinner({ className = "h-4 w-4" }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-white/30 border-t-white ${className}`} />;
}

export function Modal({ open, onClose, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative w-full ${maxWidth} glass-strong rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto scrollbar-thin`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-96">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            className={`glass-strong rounded-2xl p-4 shadow-2xl border-l-4 ${t.kind === "error" ? "border-l-rose-400" : t.kind === "success" ? "border-l-emerald-400" : "border-l-violet-400"}`}
            onClick={() => dismiss(t.id)}
          >
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            <div className="text-sm muted">{t.message}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium muted">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs muted">{hint}</span>}
    </label>
  );
}

export function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 shadow-lg shadow-violet-500/30">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M5 10v4M9 6v12M13 9v6M17 4v16M21 11v2" />
        </svg>
      </span>
      <span>
        PodMind <span className="gradient-text">AI</span>
      </span>
    </span>
  );
}
