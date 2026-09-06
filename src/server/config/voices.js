// Voice catalog. Only voices supported by the installed TTS backend are exposed.
// Silero models: v4_ru (aidar, baya, kseniya, xenia, eugene), v3_en (en_0 … en_117).
export const VOICES = {
  aidar: { id: "aidar", name: "Aidar", gender: "male", language: "ru", model: "v4_ru", role: "HOST_1", tier: "standard", description: "Calm, clear male voice. Standard Russian voice." },
  kseniya: { id: "kseniya", name: "Kseniya", gender: "female", language: "ru", model: "v4_ru", role: "HOST_2", tier: "premium", description: "Warm, conversational female voice." },
  baya: { id: "baya", name: "Baya", gender: "female", language: "ru", model: "v4_ru", role: "HOST_2", tier: "premium", description: "Soft, friendly female voice." },
  xenia: { id: "xenia", name: "Xenia", gender: "female", language: "ru", model: "v4_ru", role: "HOST_2", tier: "premium", description: "Bright, energetic female voice." },
  eugene: { id: "eugene", name: "Eugene", gender: "male", language: "ru", model: "v4_ru", role: "HOST_1", tier: "premium", description: "Deep, confident male voice." },
  en_0: { id: "en_0", name: "Silero EN 0", gender: "female", language: "en", model: "v3_en", role: "HOST_2", tier: "premium", description: "English female voice (Silero v3_en speaker en_0)." },
  en_1: { id: "en_1", name: "Silero EN 1", gender: "male", language: "en", model: "v3_en", role: "HOST_1", tier: "premium", description: "English male voice (Silero v3_en speaker en_1)." },
};

export const DEFAULT_VOICES = {
  ru: { HOST_1: process.env.TTS_HOST1 || "aidar", HOST_2: process.env.TTS_HOST2 || "kseniya" },
  en: { HOST_1: "en_1", HOST_2: "en_0" },
};

export function getVoice(id) {
  return VOICES[id] || null;
}

export function voicesForLanguage(lang) {
  return Object.values(VOICES).filter((v) => v.language === lang);
}
