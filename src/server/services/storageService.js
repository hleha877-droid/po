// Storage abstraction. `local` driver writes to STORAGE_DIR; a `supabase` driver can implement
// the same interface (put/get/remove/stat) against Supabase Storage buckets.
// Files are NEVER served directly — all reads go through backend-controlled routes.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");

function safeJoin(bucket, key) {
  const p = path.resolve(ROOT, bucket, key);
  if (!p.startsWith(path.resolve(ROOT, bucket))) throw new Error("Invalid storage path");
  return p;
}

export const storage = {
  provider: process.env.STORAGE_PROVIDER || "local",
  async put(bucket, key, buffer) {
    const p = safeJoin(bucket, key);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, buffer);
    return `${bucket}/${key}`;
  },
  async get(bucket, key) {
    return fsp.readFile(safeJoin(bucket, key));
  },
  async stat(bucket, key) {
    try {
      const s = await fsp.stat(safeJoin(bucket, key));
      return { size: s.size };
    } catch {
      return null;
    }
  },
  async remove(bucket, key) {
    try {
      await fsp.unlink(safeJoin(bucket, key));
    } catch {}
  },
  createReadStream(bucket, key, opts) {
    return fs.createReadStream(safeJoin(bucket, key), opts);
  },
  absolutePath(bucket, key) {
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
