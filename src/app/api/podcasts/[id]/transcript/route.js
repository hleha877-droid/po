import { handler, badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { getOwnedPodcast } from "@/server/services/podcastService";
import { getEntitlements, assertFeature } from "@/server/services/entitlementService";
export const dynamic = "force-dynamic";
// Transcript export (Pro+). Free users can read the transcript in-app.
export const GET = handler(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const p = await getOwnedPodcast(user.id, id);
  const { planId } = await getEntitlements(user.id);
  assertFeature(planId, "fullTranscript", "Transcript export is available on the Pro plan.");
  if (!p.script?.lines?.length) throw badRequest("No transcript yet.");
  const text = [`# ${p.title}`, "", p.description, "", ...p.script.lines.map((l) => `${l.speaker === "HOST_2" ? "Host 2" : "Host 1"}: ${l.text}`)].join("\n");
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(p.title.slice(0, 80) || "transcript")}.txt` },
  });
});
