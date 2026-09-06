import { ApiError } from "./errors.js";

// In-memory sliding window limiter. Swap for Redis in multi-instance deployments.
const buckets = globalThis.__podmindRateBuckets || (globalThis.__podmindRateBuckets = new Map());

export const LIMITS = {
  public: { windowMs: 60_000, max: 60 }, // unauthenticated, per IP
  auth: { windowMs: 15 * 60_000, max: 20 }, // login/register attempts per IP
  api: { windowMs: 60_000, max: 120 }, // authenticated general API per user
  generation: { windowMs: 60 * 60_000, max: 12 }, // generation starts per user per hour
  regenerate: { windowMs: 60 * 60_000, max: 20 },
};

export function getIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : null) || req.headers.get("x-real-ip") || "local";
}

export function rateLimit(key, limitName) {
  const limit = LIMITS[limitName];
  const now = Date.now();
  const id = `${limitName}:${key}`;
  let entry = buckets.get(id);
  if (!entry) {
    entry = [];
    buckets.set(id, entry);
  }
  while (entry.length && entry[0] <= now - limit.windowMs) entry.shift();
  if (entry.length >= limit.max) {
    const retryAfter = Math.ceil((entry[0] + limit.windowMs - now) / 1000);
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please slow down and try again shortly.", {
      retryAfter,
    });
  }
  entry.push(now);
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (!v.length || v[v.length - 1] < now - 3_600_000) buckets.delete(k);
  }
}
