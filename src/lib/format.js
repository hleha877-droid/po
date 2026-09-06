export function formatDuration(sec = 0) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
export function formatMinutes(sec = 0) {
  const m = Math.round((sec || 0) / 60);
  return m < 1 ? "<1 min" : `${m} min`;
}
export function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}
export function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function formatPrice(plan) {
  if (!plan) return "";
  return plan.price === 0 ? "$0" : `$${plan.price.toFixed(2)}`;
}
export function planBadgeClass(planId) {
  return planId === "CREATOR" ? "badge badge-creator" : planId === "PRO" ? "badge badge-pro" : "badge badge-free";
}
// Deterministic gradient cover for podcasts without a custom cover.
export function defaultCoverStyle(seed = "") {
  let h = 0;
  for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 60) % 360} 80% 45%) 60%, hsl(${(h + 120) % 360} 70% 35%))` };
}
