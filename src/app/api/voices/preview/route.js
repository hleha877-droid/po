import { handler, badRequest } from "@/server/lib/errors";
import { requireUser } from "@/server/lib/auth";
import { rateLimit } from "@/server/lib/rateLimit";
import { getVoice } from "@/server/config/voices";
import { synthesize } from "@/server/services/ttsService";
import { storage } from "@/server/services/storageService";
export const dynamic = "force-dynamic";
const SAMPLES = {
  ru: "Привет! Это PodMind. Так будет звучать ваш подкаст с этим голосом.",
  en: "Hi! This is PodMind. This is how your podcast will sound with this voice.",
};
export const GET = handler(async (req) => {
  const user = await requireUser();
  rateLimit(user.id, "api");
  const id = new URL(req.url).searchParams.get("voice");
  const voice = getVoice(id);
  if (!voice) throw badRequest("Unknown voice.");
  const key = `${voice.id}.wav`;
  let buf = (await storage.stat("previews", key)) ? await storage.get("previews", key) : null;
  if (!buf) {
    buf = await synthesize({ text: SAMPLES[voice.language] || SAMPLES.en, voiceId: voice.id, language: voice.language });
    await storage.put("previews", key, buf);
  }
  return new Response(buf, { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" } });
});
