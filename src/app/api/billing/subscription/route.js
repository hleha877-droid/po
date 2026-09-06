import { handler } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { getSubscription, IS_MOCK_BILLING, BILLING_PROVIDER } from "@/server/services/billingService";
import { serializeSubscription } from "@/server/services/subscriptionService";
export const dynamic = "force-dynamic";
export const GET = handler(async () => {
  const user = await requireUser();
  const sub = await getSubscription(user.id);
  return Response.json({ subscription: serializeSubscription(sub), billing: { provider: BILLING_PROVIDER, mock: IS_MOCK_BILLING, paymentMethod: null } });
});
