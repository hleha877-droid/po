// Storage abstraction. `local` driver writes to STORAGE_DIR; a `supabase` driver can implement
// the same interface (put/get/remove/stat) against Supabase Storage buckets.
// Files are NEVER served directly — all reads go through backend-controlled routes.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");
const PROVIDER = process.env.STORAGE_PROVIDER || "local";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function supabaseHeaders(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra };
}

function supabaseObjectUrl(bucket, key) {
  return `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage");
}

async function supabasePut(bucket, key, buffer) {
  assertSupabaseConfigured();
  const res = await fetch(supabaseObjectUrl(bucket, key), { method: "POST", headers: supabaseHeaders({ "Content-Type": "application/octet-stream", "x-upsert": "true" }), body: buffer });
  if (!res.ok) throw new Error(`Supabase storage upload failed (${res.status})`);
  return `${bucket}/${key}`;
}

async function supabaseGet(bucket, key) {
  assertSupabaseConfigured();
  const res = await fetch(supabaseObjectUrl(bucket, key), { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`Supabase storage read failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function supabaseStat(bucket, key) {
  assertSupabaseConfigured();
  const res = await fetch(supabaseObjectUrl(bucket, key), { method: "HEAD", headers: supabaseHeaders() });
  if (!res.ok) return null;
  const size = Number(res.headers.get("content-length"));
  return Number.isFinite(size) ? { size } : null;
}

async function supabaseRemove(bucket, key) {
  assertSupabaseConfigured();
  await fetch(supabaseObjectUrl(bucket, key), { method: "DELETE", headers: supabaseHeaders() });
}

function safeJoin(bucket, key) {
  const p = path.resolve(ROOT, bucket, key);
  if (!p.startsWith(path.resolve(ROOT, bucket))) throw new Error("Invalid storage path");
  return p;
}

export const storage = {
  provider: PROVIDER,
  async put(bucket, key, buffer) {
    if (PROVIDER === "supabase") return supabasePut(bucket, key, buffer);
    const p = safeJoin(bucket, key);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, buffer);
    return `${bucket}/${key}`;
  },
  async get(bucket, key) {
    if (PROVIDER === "supabase") return supabaseGet(bucket, key);
    return fsp.readFile(safeJoin(bucket, key));
  },
  async stat(bucket, key) {
    if (PROVIDER === "supabase") return supabaseStat(bucket, key);
    try {
      const s = await fsp.stat(safeJoin(bucket, key));
      return { size: s.size };
    } catch {
      return null;
    }
  },
  async remove(bucket, key) {
    if (PROVIDER === "supabase") return supabaseRemove(bucket, key);
    try {
      await fsp.unlink(safeJoin(bucket, key));
    } catch {}
  },
  createReadStream(bucket, key, opts) {
    if (PROVIDER === "supabase") {
      const start = opts?.start || 0;
      const end = opts?.end;
      return Readable.from((async function* () {
        const buf = await supabaseGet(bucket, key);
        yield end === undefined ? buf.subarray(start) : buf.subarray(start, end + 1);
      })());
    }
    return fs.createReadStream(safeJoin(bucket, key), opts);
  },
  absolutePath(bucket, key) {
    if (PROVIDER === "supabase") throw new Error("Supabase storage does not have local paths");
    return safeJoin(bucket, key);
  },
  newKey(prefix, ext) {
    return `${prefix}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  },
};

export function splitPath(storedPath) {
  const [bucket, ...rest] = storedPath.split("/");
  return { bucket, key: rest.join("/") };
}

// Short-lived signed tokens for media URLs (podcast audio / covers) so storage is never exposed directly.
const SECRET = () => process.env.SESSION_SECRET || "podmind-dev";
export function signMediaToken(payload, ttlSeconds = 3600) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyMediaToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET()).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
