import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getPlan, PLANS } from "../config/plans.js";

function periodBounds(from = new Date()) {
  const start = new Date(from);
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

export async function ensureSubscription(userId) {
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  if (existing) return existing;
  const { start, end } = periodBounds();
  const [created] = await db
    .insert(subscriptions)
    .values({ userId, plan: "FREE", status: "active", provider: process.env.BILLING_PROVIDER || "mock", currentPeriodStart: start, currentPeriodEnd: end })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return again;
}

// Resolves the *effective* plan for a user. Backend is the source of truth.
export async function getEffectiveSubscription(userId) {
  let sub = await ensureSubscription(userId);
  const now = new Date();
  // Expired canceled subscription falls back to FREE.
  if (sub.status === "canceled" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < now && sub.plan !== "FREE") {
    [sub] = await db
      .update(subscriptions)
      .set({ plan: "FREE", status: "active", cancelAtPeriodEnd: false, updatedAt: now })
      .where(eq(subscriptions.id, sub.id))
      .returning();
  }
  // Mock renewals: active paid subs roll their period forward automatically.
  if (sub.status === "active" && !sub.cancelAtPeriodEnd && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < now) {
    const { start, end } = periodBounds(now);
    [sub] = await db
      .update(subscriptions)
      .set({ currentPeriodStart: start, currentPeriodEnd: end, updatedAt: now })
      .where(eq(subscriptions.id, sub.id))
      .returning();
  }
  const effectivePlan = sub.status === "past_due" ? "FREE" : sub.plan;
  return { ...sub, effectivePlan, planConfig: getPlan(effectivePlan) };
}

export async function getUserPlan(userId) {
  const sub = await getEffectiveSubscription(userId);
  return sub.effectivePlan;
}

export function serializeSubscription(sub) {
  return {
    id: sub.id,
    plan: sub.effectivePlan || sub.plan,
    requestedPlan: sub.plan,
    status: sub.status,
    provider: sub.provider,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    planConfig: PLANS[sub.effectivePlan || sub.plan] || PLANS.FREE,
    mock: (sub.provider || "mock") === "mock",
  };
}
