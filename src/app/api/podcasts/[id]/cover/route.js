import { eq } from "drizzle-orm";
import { db } from "@/db";
import { podcasts } from "@/db/schema";
import { handler, badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { getOwnedPodcast, serializePodcast } from "@/server/services/podcastService";
import { getEntitlements, assertFeature } from "@/server/services/entitlementService";
import { storage, splitPath } from "@/server/services/storageService";
export const dynamic = "force-dynamic";
const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAGIC = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], webp: [0x52, 0x49, 0x46, 0x46] };

export const POST = handler(async (req, { params }) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const { planId, plan } = await getEntitlements(user.id);
  assertFeature(planId, "customCover", "Custom podcast covers are available on the Pro plan.");
  const form = await req.formData();
  const file = form.get("cover");
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("Please choose an image.");
  const ext = TYPES[file.type];
  if (!ext) throw badRequest("Cover must be PNG, JPG or WEBP.", "INVALID_COVER");
  if (file.size > plan.maxCoverSize) throw badRequest("Cover image must be 5MB or smaller.", "COVER_TOO_LARGE");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!MAGIC[ext].every((b, i) => buffer[i] === b)) throw badRequest("The file content does not match its image type.", "INVALID_COVER");
  const key = storage.newKey(user.id, ext);
  const coverPath = await storage.put("covers", key, buffer);
  if (p.coverPath) {
    const old = splitPath(p.coverPath);
    await storage.remove(old.bucket, old.key);
  }
  const [updated] = await db.update(podcasts).set({ coverPath, coverUrl: `/api/media/${p.id}/cover`, updatedAt: new Date() }).where(eq(podcasts.id, p.id)).returning();
  return Response.json({ podcast: serializePodcast(updated, { planId }) });
});

export const DELETE = handler(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const { planId } = await getEntitlements(user.id);
  if (p.coverPath) {
    const old = splitPath(p.coverPath);
    await storage.remove(old.bucket, old.key);
  }
  const [updated] = await db.update(podcasts).set({ coverPath: null, coverUrl: null, updatedAt: new Date() }).where(eq(podcasts.id, p.id)).returning();
  return Response.json({ podcast: serializePodcast(updated, { planId }) });
});
