import { handler } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { getUserPlan } from "@/server/services/subscriptionService";
import { getUsage, usageSummary } from "@/server/services/usageService";
export const dynamic = "force-dynamic";
export const GET = handler(async () => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const plan = await getUserPlan(user.id);
  return Response.json(usageSummary(plan, await getUsage(user.id)));
});
