import { handler, badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { getOwnedPodcast } from "@/server/services/podcastService";
import { getEntitlements, assertFeature } from "@/server/services/entitlementService";
import { storage, splitPath } from "@/server/services/storageService";
export const dynamic = "force-dynamic";

// Backend-controlled download: authenticated + owner + plan allows downloads.
export const GET = handler(async (_req, { params }) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const { planId } = await getEntitlements(user.id);
  assertFeature(planId, "downloads", "Upgrade to Pro to download your podcasts.");
  if (!p.audioPath) throw badRequest("Audio is not ready yet.");
  const { bucket, key } = splitPath(p.audioPath);
  const buf = await storage.get(bucket, key);
  const ext = p.audioFormat || "mp3";
  const safeName = (p.title || "podcast").replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim().slice(0, 80) || "podcast";
  return new Response(buf, {
    headers: {
      "Content-Type": ext === "mp3" ? "audio/mpeg" : "audio/wav",
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}.${ext}`)}`,
      "Cache-Control": "private, no-store",
    },
  });
});
