import { handler } from "@/server/lib/errors";
import { handleWebhook } from "@/server/services/billingService";
export const dynamic = "force-dynamic";
// Payment provider webhooks land here. The provider implementation verifies signatures.
export const POST = handler(async (req) => {
  const raw = await req.text();
  const result = await handleWebhook(raw, Object.fromEntries(req.headers.entries()));
  return Response.json(result);
});
