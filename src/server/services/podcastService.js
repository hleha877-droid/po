import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { podcasts } from "@/db/schema";
import { signMediaToken } from "./storageService.js";
import { STYLES, LENGTHS, getPlan } from "../config/plans.js";
import { STAGES, queuePosition } from "./generationService.js";
import { notFound } from "../lib/errors.js";

export async function getOwnedPodcast(userId, id) {
  const [p] = await db.select().from(podcasts).where(and(eq(podcasts.id, id), eq(podcasts.userId, userId))).limit(1);
  if (!p) throw notFound("Podcast not found.");
  return p;
}

export async function getPublicPodcast(id) {
  const [p] = await db.select().from(podcasts).where(and(eq(podcasts.id, id), eq(podcasts.visibility, "public"), eq(podcasts.status, "completed"))).limit(1);
  if (!p) throw notFound("This podcast is private or does not exist.");
  return p;
}

// Media URLs are signed and short-lived; storage paths are never exposed.
export function mediaUrls(p, scope = "owner") {
  const token = signMediaToken({ id: p.id, scope }, 6 * 3600);
  return {
    audioUrl: p.audioPath ? `/api/media/${p.id}/audio?token=${token}` : null,
    coverUrl: p.coverPath ? `/api/media/${p.id}/cover?token=${token}` : null,
  };
}

export function serializePodcast(p, { planId = "FREE", scope = "owner", includeScript = true } = {}) {
  const plan = getPlan(planId);
  const stage = STAGES.find((s) => s.id === p.stage);
  const media = mediaUrls(p, scope);
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    sourceFileName: p.sourceFileName,
    sourcePages: p.sourcePages,
    style: p.style,
    styleName: STYLES[p.style]?.name || p.style,
    length: p.length,
    lengthName: LENGTHS[p.length]?.name || p.length,
    language: p.language,
    voiceHost1: p.voiceHost1,
    voiceHost2: p.voiceHost2,
    status: p.status,
    stage: p.stage,
    stageLabel: stage?.label || p.stage,
    progress: p.progress,
    statusMessage: p.statusMessage,
    errorCode: p.errorCode,
    queuePosition: p.status === "queued" ? queuePosition(p.id) : 0,
    audioUrl: media.audioUrl,
    audioFormat: p.audioFormat,
    audioDurationSeconds: p.audioDurationSeconds,
    fileSize: p.fileSize,
    visibility: p.visibility,
    coverUrl: media.coverUrl,
    hasCustomCover: Boolean(p.coverPath),
    estimatedMinutes: Number(p.estimatedMinutes || 0),
    generationCostEstimate: scope === "owner" ? Number(p.generationCostEstimate || 0) : undefined,
    batchId: p.batchId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    script: includeScript ? { lines: p.script?.lines || [], provider: p.script?.provider, ttsProvider: p.script?.ttsProvider } : undefined,
    watermark: scope === "public" ? plan.watermark : undefined,
    permissions:
      scope === "owner"
        ? { download: plan.downloads, editScript: plan.editScript, regenerateAudio: plan.regenerateAudio, customCover: plan.customCover, publicSharing: plan.publicSharing, fullTranscript: plan.fullTranscript }
        : undefined,
  };
}
