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

export const GET = handler(async (_req, { params }) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const { planId } = await getEntitlements(user.id);
  return Response.json({ podcast: serializePodcast(p, { planId }) });
});

// Edit title / description / script lines / visibility. Script editing and public sharing are plan-gated.
export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const { planId } = await getEntitlements(user.id);
  const body = await req.json();
  const patch = { updatedAt: new Date() };
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 140) || p.title;
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 1000);
  if (Array.isArray(body.lines)) {
    assertFeature(planId, "editScript", "Editing the generated script is available on the Pro plan.");
    const lines = body.lines
      .map((l) => ({ speaker: l.speaker === "HOST_2" ? "HOST_2" : "HOST_1", text: String(l.text || "").trim().slice(0, 4000) }))
      .filter((l) => l.text);
    if (!lines.length) throw badRequest("The script needs at least one line.");
    if (lines.length > 600) throw badRequest("The script is too long (max 600 lines).");
    patch.script = { ...(p.script || {}), lines, editedAt: new Date().toISOString() };
  }
  if (body.visibility) {
    if (!["private", "public"].includes(body.visibility)) throw badRequest("Invalid visibility.");
    if (body.visibility === "public") assertFeature(planId, "publicSharing", "Public podcast pages are available on the Pro plan.");
    patch.visibility = body.visibility;
  }
  const [updated] = await db.update(podcasts).set(patch).where(eq(podcasts.id, p.id)).returning();
  return Response.json({ podcast: serializePodcast(updated, { planId }) });
});

export const DELETE = handler(async (_req, { params }) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  for (const sp of [p.sourcePath, p.audioPath, p.coverPath].filter(Boolean)) {
    const { bucket, key } = splitPath(sp);
    await storage.remove(bucket, key);
  }
  await db.delete(podcasts).where(eq(podcasts.id, p.id));
  return Response.json({ ok: true });
});
