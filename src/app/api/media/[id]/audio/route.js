import { eq } from "drizzle-orm";
import { db } from "@/db";
import { podcasts } from "@/db/schema";
import { handler, notFound, unauthorized } from "@/server/lib/errors";
import { getCurrentUser } from "@/server/lib/auth";
import { rateLimit, getIp } from "@/server/lib/rateLimit";
import { storage, splitPath, verifyMediaToken } from "@/server/services/storageService";
import { Readable } from "node:stream";
export const dynamic = "force-dynamic";

// Streams audio with HTTP Range support. Access: signed token OR owner session OR public podcast.
export const GET = handler(async (req, { params }) => {
  rateLimit(getIp(req), "public");
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token");
  const [p] = await db.select().from(podcasts).where(eq(podcasts.id, id)).limit(1);
  if (!p || !p.audioPath) throw notFound();
  const tokenOk = (() => {
    const t = verifyMediaToken(token);
    return t && t.id === id;
  })();
  if (!tokenOk && p.visibility !== "public") {
    const user = await getCurrentUser();
    if (!user || user.id !== p.userId) throw unauthorized("This podcast is private.");
  }
  const { bucket, key } = splitPath(p.audioPath);
  const stat = await storage.stat(bucket, key);
  if (!stat) throw notFound();
  const type = p.audioFormat === "mp3" ? "audio/mpeg" : "audio/wav";
  const range = req.headers.get("range");
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=0" };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? Number(m[1]) : 0;
    let end = m && m[2] ? Number(m[2]) : stat.size - 1;
    if (start >= stat.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    end = Math.min(end, stat.size - 1);
    const stream = Readable.toWeb(storage.createReadStream(bucket, key, { start, end }));
    return new Response(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(storage.createReadStream(bucket, key));
  return new Response(stream, { headers: { ...headers, "Content-Length": String(stat.size) } });
});
