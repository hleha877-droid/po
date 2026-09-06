import { handler } from "@/server/lib/errors";
import { rateLimit, getIp } from "@/server/lib/rateLimit";
import { authenticate, createSession, publicUser } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  rateLimit(getIp(req), "auth");
  const body = await req.json();
  const user = await authenticate(body);
  await createSession(user.id);
  return Response.json({ user: publicUser(user) });
});
