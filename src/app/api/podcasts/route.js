import { eq, and, desc, ilike } from "drizzle-orm";
import { db } from "@/db";
import { podcasts } from "@/db/schema";
import { handler, badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { assertCanGenerate, getEntitlements, formatMB } from "@/server/services/entitlementService";
import { extractPdf } from "@/server/services/pdfService";
import { storage } from "@/server/services/storageService";
import { enqueueGeneration } from "@/server/services/generationService";
import { incrementPodcasts } from "@/server/services/usageService";
import { serializePodcast } from "@/server/services/podcastService";
import { DEFAULT_VOICES } from "@/server/config/voices";
import { STYLES } from "@/server/config/plans";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");
  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 50);
  const conds = [eq(podcasts.userId, user.id)];
  if (q) conds.push(ilike(podcasts.title, `%${q}%`));
  if (status && status !== "all") {
    if (status === "processing") conds.push(eq(podcasts.status, "processing"));
    else conds.push(eq(podcasts.status, status));
  }
  let rows = await db.select().from(podcasts).where(and(...conds)).orderBy(desc(podcasts.createdAt)).limit(limit);
  if (status === "processing") {
    const queued = await db.select().from(podcasts).where(and(eq(podcasts.userId, user.id), eq(podcasts.status, "queued"))).orderBy(desc(podcasts.createdAt));
    rows = [...queued, ...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const { planId } = await getEntitlements(user.id);
  return Response.json({ podcasts: rows.map((p) => serializePodcast(p, { planId, includeScript: false })) });
});

// Create one or more podcasts (batch for Creator). All limits validated before anything is stored.
export const POST = handler(async (req) => {
  const user = await requireUser();
  rateLimit(user.id, "generation");
  const form = await req.formData();
  const files = form.getAll("files").filter((f) => f && typeof f.arrayBuffer === "function");
  if (!files.length) throw badRequest("Please attach at least one PDF.");
  const language = String(form.get("language") || "ru");
  const style = String(form.get("style") || "quick_summary");
  const length = String(form.get("length") || "quick");
  const defaults = DEFAULT_VOICES[language] || DEFAULT_VOICES.ru;
  const voiceHost1 = String(form.get("voiceHost1") || defaults.HOST_1);
  const voiceHost2 = (STYLES[style]?.hosts || 1) === 2 ? String(form.get("voiceHost2") || defaults.HOST_2) : null;

  const { plan } = await getEntitlements(user.id);
  // Pass 1: cheap checks (count, plan features, file size) before parsing anything.
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name || "")) throw badRequest(`"${f.name}" is not a PDF file.`, "INVALID_PDF");
    await assertCanGenerate(user.id, { style, length, language, voiceHost1, voiceHost2, fileSize: f.size, pages: 0, count: files.length });
  }
  // Pass 2: parse to enforce real page counts (never trust file size alone).
  const parsed = [];
  for (const f of files) {
    const buffer = Buffer.from(await f.arrayBuffer());
    const { pages } = await extractPdf(buffer);
    await assertCanGenerate(user.id, { style, length, language, voiceHost1, voiceHost2, fileSize: buffer.length, pages, count: files.length });
    parsed.push({ file: f, buffer, pages });
  }

  const batchId = files.length > 1 ? crypto.randomUUID() : null;
  const created = [];
  for (const { file, buffer, pages } of parsed) {
    const key = storage.newKey(user.id, "pdf");
    const sourcePath = await storage.put("uploads", key, buffer);
    const [row] = await db
      .insert(podcasts)
      .values({
        userId: user.id,
        title: file.name.replace(/\.pdf$/i, ""),
        sourceFileName: file.name,
        sourcePath,
        sourcePages: pages,
        style,
        length,
        language,
        voiceHost1,
        voiceHost2: voiceHost2 || defaults.HOST_2,
        status: "queued",
        stage: "queued",
        progress: 3,
        statusMessage: batchId ? "Waiting in batch queue…" : "Queued…",
        fileSize: buffer.length,
        batchId,
      })
      .returning();
    await incrementPodcasts(user.id, 1);
    created.push(row);
  }
  for (const row of created) enqueueGeneration(row.id, { priority: plan.priorityProcessing });
  return Response.json({ podcasts: created.map((p) => serializePodcast(p, { planId: plan.id })), batchId, maxFileSize: formatMB(plan.maxFileSize) }, { status: 201 });
});
