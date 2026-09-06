import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { getPlan } from "../config/plans.js";

export function currentMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getUsage(userId, month = currentMonth()) {
  const [row] = await db.select().from(usage).where(and(eq(usage.userId, userId), eq(usage.month, month))).limit(1);
  if (row) return { ...row, audioMinutesGenerated: Number(row.audioMinutesGenerated) };
  const [created] = await db.insert(usage).values({ userId, month }).onConflictDoNothing().returning();
  if (created) return { ...created, audioMinutesGenerated: 0 };
  return getUsage(userId, month);
}

export async function incrementPodcasts(userId, n = 1) {
  const month = currentMonth();
  await getUsage(userId, month);
  await db
    .update(usage)
    .set({ podcastsCreated: sql`${usage.podcastsCreated} + ${n}`, updatedAt: new Date() })
    .where(and(eq(usage.userId, userId), eq(usage.month, month)));
}

export async function incrementAudioMinutes(userId, minutes) {
  const month = currentMonth();
  await getUsage(userId, month);
  await db
    .update(usage)
    .set({ audioMinutesGenerated: sql`${usage.audioMinutesGenerated} + ${Number(minutes).toFixed(2)}`, updatedAt: new Date() })
    .where(and(eq(usage.userId, userId), eq(usage.month, month)));
}

export async function resetUsage(userId) {
  const month = currentMonth();
  await db.update(usage).set({ podcastsCreated: 0, audioMinutesGenerated: "0", updatedAt: new Date() }).where(and(eq(usage.userId, userId), eq(usage.month, month)));
}

export function usageSummary(planId, u) {
  const plan = getPlan(planId);
  const pct = (used, max) => (max ? Math.min(100, Math.round((used / max) * 100)) : 0);
  return {
    month: u.month,
    plan: planId,
    podcasts: { used: u.podcastsCreated, limit: plan.monthlyPodcasts, percent: pct(u.podcastsCreated, plan.monthlyPodcasts), remaining: Math.max(0, plan.monthlyPodcasts - u.podcastsCreated) },
    audioMinutes: {
      used: Math.round(u.audioMinutesGenerated * 10) / 10,
      limit: plan.monthlyAudioMinutes,
      percent: pct(u.audioMinutesGenerated, plan.monthlyAudioMinutes),
      remaining: Math.max(0, Math.round((plan.monthlyAudioMinutes - u.audioMinutesGenerated) * 10) / 10),
    },
    pdf: { maxPages: plan.maxPdfPages, maxFileSize: plan.maxFileSize },
  };
}
