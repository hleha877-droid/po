import { handler, badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { createCheckoutSession, IS_MOCK_BILLING } from "@/server/services/billingService";
import { getEffectiveSubscription, serializeSubscription } from "@/server/services/subscriptionService";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const { planId, returnUrl } = await req.json();
  if (!planId || planId === "FREE") throw badRequest("Choose a paid plan to start checkout.");
  const session = await createCheckoutSession({ user, planId, returnUrl });
  const sub = await getEffectiveSubscription(user.id);
  return Response.json({ checkout: { mode: session.mode, url: session.url, completed: session.completed, mock: IS_MOCK_BILLING }, subscription: serializeSubscription(sub) });
});
