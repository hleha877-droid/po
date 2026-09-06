import { eq } from "drizzle-orm";
import { db } from "@/db";
import { podcasts } from "@/db/schema";
import { handler, notFound, unauthorized } from "@/server/lib/errors";
import { getCurrentUser } from "@/server/lib/auth";
import { storage, splitPath, verifyMediaToken } from "@/server/services/storageService";
export const dynamic = "force-dynamic";
export const GET = handler(async (req, { params }) => {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token");
  const [p] = await db.select().from(podcasts).where(eq(podcasts.id, id)).limit(1);
  if (!p || !p.coverPath) throw notFound();
  const t = verifyMediaToken(token);
  if (!(t && t.id === id) && p.visibility !== "public") {
    const user = await getCurrentUser();
    if (!user || user.id !== p.userId) throw unauthorized();
  }
  const { bucket, key } = splitPath(p.coverPath);
  const buf = await storage.get(bucket, key);
  const ext = key.split(".").pop();
  const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new Response(buf, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
});
