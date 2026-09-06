import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handler } from "@/server/lib/errors";
import { rateLimit, getIp } from "@/server/lib/rateLimit";
import { getPublicPodcast, serializePodcast } from "@/server/services/podcastService";
import { getUserPlan } from "@/server/services/subscriptionService";
import { getPlan } from "@/server/config/plans";
export const dynamic = "force-dynamic";
// Public podcast page data. Only podcasts explicitly marked public are returned.
export const GET = handler(async (req, { params }) => {
  rateLimit(getIp(req), "public");
  const { id } = await params;
  const p = await getPublicPodcast(id);
  const ownerPlan = await getUserPlan(p.userId);
  const [owner] = await db.select({ name: users.name, preferences: users.preferences }).from(users).where(eq(users.id, p.userId)).limit(1);
  const plan = getPlan(ownerPlan);
  const branding = plan.branding ? { name: owner?.preferences?.brandName || owner?.name || null, color: owner?.preferences?.brandColor || null } : null;
  return Response.json({ podcast: serializePodcast(p, { planId: ownerPlan, scope: "public" }), author: owner?.name || "PodMind creator", branding, watermark: plan.watermark });
});
