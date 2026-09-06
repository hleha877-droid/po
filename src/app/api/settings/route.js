import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handler, badRequest } from "@/server/lib/errors";
import { requireUser, publicUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
export const dynamic = "force-dynamic";
const ALLOWED_PREFS = ["defaultLanguage", "defaultVoiceHost1", "defaultVoiceHost2", "defaultStyle", "defaultLength", "playbackSpeed", "theme", "notifications", "brandName", "brandColor"];
export const PATCH = handler(async (req) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const body = await req.json();
  const patch = { updatedAt: new Date() };
  if (typeof body.name === "string") {
    if (!body.name.trim()) throw badRequest("Name cannot be empty.");
    patch.name = body.name.trim().slice(0, 80);
  }
  if (typeof body.avatarUrl === "string") patch.avatarUrl = body.avatarUrl.trim().slice(0, 500) || null;
  if (body.preferences && typeof body.preferences === "object") {
    const prefs = { ...(user.preferences || {}) };
    for (const k of ALLOWED_PREFS) if (k in body.preferences) prefs[k] = body.preferences[k];
    patch.preferences = prefs;
  }
  const [updated] = await db.update(users).set(patch).where(eq(users.id, user.id)).returning();
  return Response.json({ user: publicUser(updated) });
});
