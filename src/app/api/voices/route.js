import { handler } from "@/server/lib/errors";
import { VOICES, DEFAULT_VOICES } from "@/server/config/voices";
import { ttsHealth } from "@/server/services/ttsService";
import { minimumPlanFor } from "@/server/config/plans";
export const dynamic = "force-dynamic";
export const GET = handler(async () => {
  const health = await ttsHealth();
  // Only expose voices the installed TTS backend actually reports (when it reports them).
  const voices = Object.values(VOICES)
    .filter((v) => !health.speakers || health.speakers.includes(v.id))
    .map((v) => ({ ...v, requiredPlan: minimumPlanFor("availableVoices", v.id) }));
  return Response.json({ voices, defaults: DEFAULT_VOICES, tts: { provider: health.provider, online: health.ok, mockFallback: !health.ok && process.env.TTS_FALLBACK_MOCK === "true" } });
});
