// End-to-end pipeline: PDF -> AI script -> TTS -> combine -> store.
// Jobs run sequentially in-process via a priority queue (paid plans first) to avoid overloading TTS.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { podcasts } from "@/db/schema";
import { storage, splitPath } from "./storageService.js";
import { extractPdf, selectContext } from "./pdfService.js";
import { generateScript, chunksForLength } from "./aiService.js";
import { synthesize, resolveProvider } from "./ttsService.js";
import { combineSegments } from "./audioService.js";
import { assertAudioAllowance, estimateMinutesFromWords, countWords, estimateCost } from "./entitlementService.js";
import { incrementAudioMinutes } from "./usageService.js";
import { getUserPlan } from "./subscriptionService.js";
import { getPlan } from "../config/plans.js";
import { ApiError } from "../lib/errors.js";

export const STAGES = [
  { id: "uploading", label: "Uploading", progress: 5 },
  { id: "extracting", label: "Extracting document", progress: 15 },
  { id: "understanding", label: "Understanding content", progress: 25 },
  { id: "writing", label: "Writing podcast", progress: 45 },
  { id: "preparing_voices", label: "Preparing voices", progress: 55 },
  { id: "generating_audio", label: "Generating audio", progress: 60 },
  { id: "combining", label: "Combining audio", progress: 92 },
  { id: "finishing", label: "Finishing", progress: 97 },
  { id: "completed", label: "Ready", progress: 100 },
];

const queue = globalThis.__podmindQueue || (globalThis.__podmindQueue = { priority: [], normal: [], running: false });

async function update(id, patch) {
  await db.update(podcasts).set({ ...patch, updatedAt: new Date() }).where(eq(podcasts.id, id));
}

async function setStage(id, stageId, message, progressOverride) {
  const s = STAGES.find((x) => x.id === stageId);
  await update(id, { stage: stageId, progress: progressOverride ?? s.progress, statusMessage: message || s.label, status: stageId === "completed" ? "completed" : "processing" });
}

export function enqueueGeneration(podcastId, { priority = false, mode = "full" } = {}) {
  (priority ? queue.priority : queue.normal).push({ podcastId, mode });
  void pump();
}

async function pump() {
  if (queue.running) return;
  queue.running = true;
  try {
    while (queue.priority.length || queue.normal.length) {
      const job = queue.priority.shift() || queue.normal.shift();
      try {
        if (job.mode === "audio") await runAudioOnly(job.podcastId);
        else await runFull(job.podcastId);
      } catch (e) {
        console.error("generation job failed", job, e);
      }
    }
  } finally {
    queue.running = false;
  }
}

export function queuePosition(podcastId) {
  const all = [...queue.priority, ...queue.normal];
  const i = all.findIndex((j) => j.podcastId === podcastId);
  return i === -1 ? 0 : i + 1;
}

async function fail(id, err) {
  const code = err instanceof ApiError ? err.code : "GENERATION_FAILED";
  const extraCode = err instanceof ApiError && err.extra?.code ? err.extra.code : null;
  await update(id, { status: "failed", stage: "failed", errorCode: extraCode || code, statusMessage: err.message || "Generation failed." });
}

async function runFull(id) {
  const [p] = await db.select().from(podcasts).where(eq(podcasts.id, id));
  if (!p || p.status === "completed") return;
  try {
    await setStage(id, "extracting");
    const { bucket, key } = splitPath(p.sourcePath);
    const pdfBuffer = await storage.get(bucket, key);
    const { pages, text } = await extractPdf(pdfBuffer);
    if (!text || countWords(text) < 40) {
      throw new ApiError(400, "PDF_NO_TEXT", "This PDF has no extractable text (it may be scanned images). Try a text-based PDF.");
    }
    await update(id, { sourcePages: pages });

    await setStage(id, "understanding", `Reading ${pages} page${pages === 1 ? "" : "s"}…`);
    const { context } = selectContext(text, chunksForLength(p.length));

    await setStage(id, "writing", "Writing the podcast script…");
    const script = await generateScript({ context, style: p.style, length: p.length, language: p.language, fileName: p.sourceFileName });
    const words = script.lines.reduce((n, l) => n + countWords(l.text), 0);
    const estimatedMinutes = estimateMinutesFromWords(words, p.language);
    await update(id, {
      title: script.title || p.title,
      description: script.description || p.description,
      script: { lines: script.lines, provider: script.provider },
      estimatedMinutes: String(estimatedMinutes),
    });

    await synthesizeAndStore(id, { ...p, script: { lines: script.lines, provider: script.provider } }, estimatedMinutes, pages);
  } catch (e) {
    await fail(id, e);
  }
}

// Regenerate audio from an (edited) script without calling the LLM again.
async function runAudioOnly(id) {
  const [p] = await db.select().from(podcasts).where(eq(podcasts.id, id));
  if (!p || !p.script?.lines?.length) return;
  try {
    const words = p.script.lines.reduce((n, l) => n + countWords(l.text), 0);
    const estimatedMinutes = estimateMinutesFromWords(words, p.language);
    await update(id, { estimatedMinutes: String(estimatedMinutes) });
    await synthesizeAndStore(id, p, estimatedMinutes, p.sourcePages);
  } catch (e) {
    await fail(id, e);
  }
}

async function synthesizeAndStore(id, p, estimatedMinutes, pages) {
  await setStage(id, "preparing_voices", "Preparing voices…");
  // COST CONTROL: never start TTS if the estimate exceeds the remaining allowance.
  await assertAudioAllowance(p.userId, estimatedMinutes);
  const provider = await resolveProvider();
  const lines = p.script.lines;
  const segments = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const voiceId = line.speaker === "HOST_2" ? p.voiceHost2 : p.voiceHost1;
    segments.push(await synthesize({ text: line.text, voiceId, language: p.language, provider }));
    const pct = 60 + Math.round(((i + 1) / lines.length) * 30);
    await setStage(id, "generating_audio", `Voicing line ${i + 1} of ${lines.length}…`, pct);
  }
  await setStage(id, "combining", "Combining audio…");
  const combined = await combineSegments(segments);

  await setStage(id, "finishing", "Finishing…");
  const key = storage.newKey(p.userId, combined.format);
  const audioPath = await storage.put("audio", key, combined.buffer);
  if (p.audioPath && p.audioPath !== audioPath) {
    const old = splitPath(p.audioPath);
    await storage.remove(old.bucket, old.key);
  }
  const duration = Math.round(combined.durationSeconds);
  const minutes = Math.round((duration / 60) * 100) / 100;
  await incrementAudioMinutes(p.userId, minutes);
  await update(id, {
    audioPath,
    audioFormat: combined.format,
    audioDurationSeconds: duration,
    fileSize: combined.buffer.length,
    generationCostEstimate: String(estimateCost({ pages, minutes })),
    errorCode: null,
    script: { ...(p.script || {}), ttsProvider: provider },
  });
  await setStage(id, "completed", "Your podcast is ready.");
}

export async function priorityFor(userId) {
  const plan = getPlan(await getUserPlan(userId));
  return Boolean(plan.priorityProcessing);
}
