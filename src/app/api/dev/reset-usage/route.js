import { handler, notFound, DEV_TOOLS_ENABLED } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { resetUsage, getUsage, usageSummary } from "@/server/services/usageService";
import { getUserPlan } from "@/server/services/subscriptionService";
export const dynamic = "force-dynamic";
// Development-only utility. Returns 404 in production so it is never discoverable.
export const POST = handler(async () => {
  if (!DEV_TOOLS_ENABLED) throw notFound();
  const user = await requireUser();
  await resetUsage(user.id);
  const plan = await getUserPlan(user.id);
  return Response.json({ ok: true, usage: usageSummary(plan, await getUsage(user.id)) });
});
