import { handler } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { changePlan } from "@/server/services/billingService";
import { getEffectiveSubscription, serializeSubscription } from "@/server/services/subscriptionService";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const { planId } = await req.json();
  const result = await changePlan(user.id, planId);
  const sub = await getEffectiveSubscription(user.id);
  return Response.json({ direction: result.direction, subscription: serializeSubscription(sub) });
});
