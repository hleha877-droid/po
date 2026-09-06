import { handler } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { getOwnedPodcast, serializePodcast } from "@/server/services/podcastService";
import { getUserPlan } from "@/server/services/subscriptionService";
export const dynamic = "force-dynamic";
export const GET = handler(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const planId = await getUserPlan(user.id);
  return Response.json({ podcast: serializePodcast(p, { planId, includeScript: p.status === "completed" }) });
});
