import { eq } from "drizzle-orm";
import { db } from "@/db";
import { podcasts } from "@/db/schema";
import { handler, badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { getOwnedPodcast, serializePodcast } from "@/server/services/podcastService";
import { getEntitlements, assertFeature, assertAudioAllowance, estimateMinutesFromWords, countWords } from "@/server/services/entitlementService";
import { enqueueGeneration } from "@/server/services/generationService";
import { getVoice } from "@/server/config/voices";
export const dynamic = "force-dynamic";

// Re-synthesizes audio from the stored (possibly edited) script. Never calls the LLM.
export const POST = handler(async (req, { params }) => {
  const user = await requireUser();
  rateLimit(user.id, "regenerate");
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const { planId, plan } = await getEntitlements(user.id);
  assertFeature(planId, "regenerateAudio", "Regenerating audio is available on the Pro plan.");
  if (!p.script?.lines?.length) throw badRequest("This podcast has no script yet.");
  if (p.status === "processing") throw badRequest("This podcast is already being processed.");
  const body = await req.json().catch(() => ({}));
  const patch = { status: "queued", stage: "queued", progress: 3, statusMessage: "Queued for audio regeneration…", errorCode: null, updatedAt: new Date() };
  for (const k of ["voiceHost1", "voiceHost2"]) {
    if (body[k]) {
      const v = getVoice(body[k]);
      if (!v || v.language !== p.language) throw badRequest("Invalid voice for this podcast.", "VOICE_UNAVAILABLE");
      if (!plan.availableVoices.includes(body[k])) throw badRequest(`${v.name} is not included in your plan.`, "PREMIUM_REQUIRED");
      patch[k] = body[k];
    }
  }
  const words = p.script.lines.reduce((n, l) => n + countWords(l.text), 0);
  await assertAudioAllowance(user.id, estimateMinutesFromWords(words, p.language));
  const [updated] = await db.update(podcasts).set(patch).where(eq(podcasts.id, p.id)).returning();
  enqueueGeneration(p.id, { priority: plan.priorityProcessing, mode: "audio" });
  return Response.json({ podcast: serializePodcast(updated, { planId }) });
});
