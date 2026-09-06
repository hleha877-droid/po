import { handler } from "@/server/lib/errors";
import { destroySession } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const POST = handler(async () => {
  await destroySession();
  return Response.json({ ok: true });
});
