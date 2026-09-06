import { handler } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { getBillingHistory } from "@/server/services/billingService";
export const dynamic = "force-dynamic";
export const GET = handler(async () => {
  const user = await requireUser();
  const events = await getBillingHistory(user.id);
  return Response.json({ events });
});
