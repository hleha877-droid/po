import { handler } from "@/server/lib/errors";
import { getCurrentUser, publicUser } from "@/server/lib/auth";
import { getEffectiveSubscription, serializeSubscription } from "@/server/services/subscriptionService";
import { getUsage, usageSummary } from "@/server/services/usageService";
export const dynamic = "force-dynamic";
export const GET = handler(async () => {
  const user = await getCurrentUser();
  if (!user) return Response.json({ user: null, subscription: null, usage: null });
  const sub = await getEffectiveSubscription(user.id);
  const usage = await getUsage(user.id);
  return Response.json({ user: publicUser(user), subscription: serializeSubscription(sub), usage: usageSummary(sub.effectivePlan, usage) });
});
