// Billing abstraction. Providers implement the same interface so Stripe/Paddle/YooKassa
// can be plugged in later without touching the rest of the application.
//
//   createCheckoutSession({ user, planId, returnUrl })
//   getSubscription(userId)
//   cancelSubscription(userId)
//   changePlan(userId, planId)
//   handleWebhook(rawBody, headers)

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, billingEvents } from "@/db/schema";
import { PLANS, planRank } from "../config/plans.js";
import { getEffectiveSubscription, ensureSubscription } from "./subscriptionService.js";
import { badRequest, ApiError } from "../lib/errors.js";

export const BILLING_PROVIDER = process.env.BILLING_PROVIDER || "mock";
export const IS_MOCK_BILLING = BILLING_PROVIDER === "mock";
export const isProduction = process.env.NODE_ENV === "production";

async function logEvent(userId, type, payload) {
  await db.insert(billingEvents).values({ userId, provider: BILLING_PROVIDER, type, payload });
}

function period(from = new Date()) {
  const start = new Date(from);
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

function assertPlan(planId) {
  if (!PLANS[planId]) throw badRequest("Unknown plan.", "UNKNOWN_PLAN");
}

// ---------------------------------------------------------------------------
// MOCK PROVIDER — development/testing only. No money moves. No real payment is
// claimed to have happened; the UI labels it as mock billing.
// ---------------------------------------------------------------------------
const mockProvider = {
  name: "mock",

  async createCheckoutSession({ user, planId }) {
    assertPlan(planId);
    // Mock billing only runs when explicitly opted in via BILLING_PROVIDER=mock. Set BILLING_PROVIDER=stripe
    // (or another real provider) for production — the mock provider is then never loaded.
    if (process.env.BILLING_PROVIDER !== "mock") {
      throw new ApiError(503, "BILLING_UNAVAILABLE", "Payments are not configured yet. Please contact support.");
    }
    await ensureSubscription(user.id);
    const { start, end } = period();
    const [sub] = await db
      .update(subscriptions)
      .set({
        plan: planId,
        status: "active",
        provider: "mock",
        providerCustomerId: `mock_cus_${user.id.slice(0, 8)}`,
        providerSubscriptionId: `mock_sub_${Date.now()}`,
        cancelAtPeriodEnd: false,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, user.id))
      .returning();
    await logEvent(user.id, "mock.checkout.completed", { planId, note: "MOCK billing — no real payment" });
    // Real providers return a hosted checkout URL; mock completes instantly.
    return { mode: "mock", completed: true, url: null, subscription: sub };
  },

  async getSubscription(userId) {
    return getEffectiveSubscription(userId);
  },

  async cancelSubscription(userId) {
    const sub = await getEffectiveSubscription(userId);
    if (sub.plan === "FREE") throw badRequest("You are on the Free plan — there is nothing to cancel.");
    const [updated] = await db
      .update(subscriptions)
      .set({ status: "canceled", cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId))
      .returning();
    await logEvent(userId, "mock.subscription.canceled", { plan: sub.plan, accessUntil: sub.currentPeriodEnd });
    return updated;
  },

  async changePlan(userId, planId) {
    assertPlan(planId);
    const sub = await getEffectiveSubscription(userId);
    if (sub.plan === planId && sub.status === "active" && !sub.cancelAtPeriodEnd) {
      throw badRequest(`You are already on the ${PLANS[planId].name} plan.`);
    }
    const direction = planRank(planId) > planRank(sub.plan) ? "upgrade" : planRank(planId) < planRank(sub.plan) ? "downgrade" : "renew";
    const { start, end } = period();
    const patch = { plan: planId, status: "active", cancelAtPeriodEnd: false, updatedAt: new Date() };
    // Upgrades / renewals start a fresh period; downgrades keep the current period.
    if (direction !== "downgrade" || planId === "FREE") Object.assign(patch, { currentPeriodStart: start, currentPeriodEnd: end });
    const [updated] = await db.update(subscriptions).set(patch).where(eq(subscriptions.userId, userId)).returning();
    await logEvent(userId, `mock.subscription.${direction}`, { from: sub.plan, to: planId });
    return { direction, subscription: updated };
  },

  async handleWebhook(rawBody) {
    // Mock webhooks simply echo — a real provider would verify signatures here.
    await logEvent(null, "mock.webhook.received", { size: rawBody?.length || 0 });
    return { received: true, mock: true };
  },
};

const YOOKASSA_API = "https://api.yookassa.ru/v3";

function yookassaConfig() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new ApiError(503, "BILLING_UNAVAILABLE", "YooKassa is not configured.");
  return { shopId, secretKey };
}

async function yookassaRequest(path, options = {}) {
  const { shopId, secretKey } = yookassaConfig();
  const response = await fetch(`${YOOKASSA_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(503, "BILLING_UNAVAILABLE", `YooKassa returned an error (${response.status}).`, { detail: body });
  }
  return body;
}

function yookassaReturnUrl(returnUrl) {
  const base = process.env.APP_URL || "http://localhost:3000";
  return new URL(returnUrl || "/settings/billing", base).toString();
}

const yookassaProvider = {
  name: "yookassa",

  async createCheckoutSession({ user, planId, returnUrl }) {
    assertPlan(planId);
    if (planId === "FREE") throw badRequest("Choose a paid plan to start checkout.");
    const plan = PLANS[planId];
    const amount = Number(plan.approxLocal?.amount || 0);
    if (!amount) throw new ApiError(503, "BILLING_UNAVAILABLE", "This plan has no YooKassa price configured.");
    const payment = await yookassaRequest("/payments", {
      method: "POST",
      headers: { "Idempotence-Key": `podmind-${user.id}-${planId}-${Date.now()}` },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency: process.env.YOOKASSA_CURRENCY || "RUB" },
        capture: true,
        description: `PodMind ${plan.name} plan for ${user.email}`,
        confirmation: { type: "redirect", return_url: yookassaReturnUrl(returnUrl) },
        metadata: { userId: user.id, planId },
      }),
    });
    await logEvent(user.id, "yookassa.checkout.created", { paymentId: payment.id, planId, amount });
    return { mode: "yookassa", completed: false, url: payment.confirmation?.confirmation_url, paymentId: payment.id };
  },

  async getSubscription(userId) {
    return getEffectiveSubscription(userId);
  },

  async cancelSubscription(userId) {
    const sub = await getEffectiveSubscription(userId);
    if (sub.plan === "FREE") throw badRequest("You are on the Free plan — there is nothing to cancel.");
    const [updated] = await db.update(subscriptions).set({ status: "canceled", cancelAtPeriodEnd: true, updatedAt: new Date() }).where(eq(subscriptions.userId, userId)).returning();
    await logEvent(userId, "yookassa.subscription.canceled", { plan: sub.plan, accessUntil: sub.currentPeriodEnd });
    return updated;
  },

  async changePlan(userId, planId) {
    assertPlan(planId);
    if (planId !== "FREE") throw new ApiError(409, "CHECKOUT_REQUIRED", "Start checkout to change to a paid plan.");
    const [updated] = await db.update(subscriptions).set({ plan: "FREE", status: "active", cancelAtPeriodEnd: false, updatedAt: new Date() }).where(eq(subscriptions.userId, userId)).returning();
    return { direction: "downgrade", subscription: updated };
  },

  async handleWebhook(rawBody) {
    let event;
    try { event = JSON.parse(rawBody); } catch { throw badRequest("Invalid YooKassa webhook JSON."); }
    const paymentId = event.object?.id;
    if (!paymentId) throw badRequest("YooKassa webhook has no payment id.");
    // YooKassa webhooks are verified by fetching the payment with server credentials.
    const payment = await yookassaRequest(`/payments/${paymentId}`);
    const userId = payment.metadata?.userId;
    const planId = payment.metadata?.planId;
    if (!userId || !PLANS[planId]) throw badRequest("YooKassa payment metadata is incomplete.");
    if (payment.status === "succeeded") {
      const { start, end } = period();
      await db.update(subscriptions).set({ plan: planId, status: "active", provider: "yookassa", providerCustomerId: payment.payer?.phone || null, providerSubscriptionId: payment.id, cancelAtPeriodEnd: false, currentPeriodStart: start, currentPeriodEnd: end, updatedAt: new Date() }).where(eq(subscriptions.userId, userId));
      await logEvent(userId, "yookassa.payment.succeeded", { paymentId, planId });
    } else if (payment.status === "canceled") {
      await logEvent(userId, "yookassa.payment.canceled", { paymentId, planId });
    }
    return { received: true, paymentId, status: payment.status };
  },
};

// Placeholder for Stripe. Set BILLING_PROVIDER=stripe only after implementing its credentials.
const stripeProvider = {
  name: "stripe",
  async createCheckoutSession() {
    throw new ApiError(503, "BILLING_UNAVAILABLE", "Stripe billing is not configured. Set STRIPE_SECRET_KEY and implement billingService stripeProvider.");
  },
  async getSubscription(userId) {
    return getEffectiveSubscription(userId);
  },
  async cancelSubscription() {
    throw new ApiError(503, "BILLING_UNAVAILABLE", "Stripe billing is not configured.");
  },
  async changePlan() {
    throw new ApiError(503, "BILLING_UNAVAILABLE", "Stripe billing is not configured.");
  },
  async handleWebhook() {
    throw new ApiError(503, "BILLING_UNAVAILABLE", "Stripe billing is not configured.");
  },
};

const providers = { mock: mockProvider, stripe: stripeProvider, yookassa: yookassaProvider };
const provider = providers[BILLING_PROVIDER] || mockProvider;

export const createCheckoutSession = (args) => provider.createCheckoutSession(args);
export const getSubscription = (userId) => provider.getSubscription(userId);
export const cancelSubscription = (userId) => provider.cancelSubscription(userId);
export const changePlan = (userId, planId) => provider.changePlan(userId, planId);
export const handleWebhook = (rawBody, headers) => provider.handleWebhook(rawBody, headers);

export async function getBillingHistory(userId) {
  const rows = await db.select().from(billingEvents).where(eq(billingEvents.userId, userId)).orderBy(billingEvents.createdAt);
  return rows.reverse().slice(0, 20);
}
