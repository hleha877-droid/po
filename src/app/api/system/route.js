import { handler, DEV_TOOLS_ENABLED } from "@/server/lib/errors";
import { ttsHealth } from "@/server/services/ttsService";
import { hasFfmpeg } from "@/server/services/audioService";
import { AI_PROVIDER } from "@/server/services/aiService";
import { BILLING_PROVIDER } from "@/server/services/billingService";
export const dynamic = "force-dynamic";
// Non-secret capability info so the UI can show honest status (mock TTS, WAV vs MP3, etc).
export const GET = handler(async () => {
  const tts = await ttsHealth();
  return Response.json({
    ai: AI_PROVIDER,
    tts: tts.provider === "gemini" ? "gemini" : tts.provider === "mock" || !tts.ok ? "mock" : "silero",
    ttsOnline: tts.ok,
    ffmpeg: await hasFfmpeg(),
    billing: BILLING_PROVIDER,
    env: process.env.NODE_ENV === "production" ? "production" : "development",
    devTools: DEV_TOOLS_ENABLED,
    mockBilling: BILLING_PROVIDER === "mock",
  });
});
