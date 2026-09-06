import { handler } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { cancelSubscription } from "@/server/services/billingService";
import { getEffectiveSubscription, serializeSubscription } from "@/server/services/subscriptionService";
export const dynamic = "force-dynamic";
export const POST = handler(async () => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  await cancelSubscription(user.id);
  const sub = await getEffectiveSubscription(user.id);
  return Response.json({ subscription: serializeSubscription(sub) });
});
