// Text-to-speech. Primary provider can be Gemini Audio or Silero via a small HTTP microservice.
// Contract:  POST {TTS_SERVICE_URL}/tts  {text, speaker, sample_rate, language} -> audio/wav
//            GET  {TTS_SERVICE_URL}/health -> {ok: true, speakers: [...]}
// Fallback provider `mock` synthesizes placeholder WAV audio so the pipeline is testable offline.
import { ApiError } from "../lib/errors.js";
import { getVoice } from "../config/voices.js";
import { LANGUAGES } from "../config/plans.js";

export const SAMPLE_RATE = 24000;
const TTS_URL = process.env.TTS_SERVICE_URL || "http://localhost:8000";
const CONFIGURED = process.env.TTS_PROVIDER || "silero";

let healthCache = { at: 0, ok: false, speakers: null };

export async function ttsHealth() {
  if (CONFIGURED === "gemini") return { provider: "gemini", ok: Boolean(process.env.GEMINI_API_KEY), speakers: null };
  if (CONFIGURED === "mock") return { provider: "mock", ok: true, speakers: null };
  if (Date.now() - healthCache.at < 30_000) return { provider: "silero", ...healthCache };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${TTS_URL}/health`, { signal: controller.signal });
    clearTimeout(t);
    const json = res.ok ? await res.json() : {};
    healthCache = { at: Date.now(), ok: res.ok, speakers: json.speakers || null };
  } catch {
    healthCache = { at: Date.now(), ok: false, speakers: null };
  }
  return { provider: "silero", ...healthCache };
}

// Which provider will actually be used for the next synthesis.
export async function resolveProvider() {
  if (CONFIGURED === "gemini") {
    if (process.env.GEMINI_API_KEY) return "gemini";
    if (process.env.TTS_FALLBACK_MOCK !== "true") throw new ApiError(503, "TTS_UNAVAILABLE", "GEMINI_API_KEY is not configured.");
    return "mock";
  }
  if (CONFIGURED === "mock") return "mock";
  const h = await ttsHealth();
  if (h.ok) return "silero";
  // Placeholder audio is only used when explicitly allowed (TTS_FALLBACK_MOCK=true). Otherwise fail loudly.
  if (process.env.TTS_FALLBACK_MOCK !== "true") {
    throw new ApiError(503, "TTS_UNAVAILABLE", "The voice engine is temporarily unavailable. Please try again later.");
  }
  return "mock";
}

// Silero wants short, punctuated sentences. Split long lines into chunks < 900 chars.
export function splitForTts(text, max = 900) {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?…])\s+/);
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).length > max && cur) {
      out.push(cur.trim());
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

async function sileroSynthesize(text, voiceId) {
  const voice = getVoice(voiceId);
  const res = await fetch(`${TTS_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, speaker: voiceId, sample_rate: SAMPLE_RATE, language: voice?.language || "ru", model: voice?.model }),
  });
  if (!res.ok) throw new ApiError(503, "TTS_UNAVAILABLE", `The voice engine returned an error (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

const GEMINI_VOICES = {
  aidar: "Charon",
  kseniya: "Aoede",
  baya: "Leda",
  xenia: "Kore",
  eugene: "Orus",
  en_0: "Aoede",
  en_1: "Charon",
};

async function geminiSynthesize(text, voiceId, language) {
  const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
  const voiceName = GEMINI_VOICES[voiceId] || (language === "ru" ? "Charon" : "Kore");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
  });
  if (!res.ok) {
    const details = await res.json().catch(() => ({}));
    throw new ApiError(503, "TTS_UNAVAILABLE", details.error?.message || `Gemini TTS returned an error (${res.status}).`);
  }
  const json = await res.json();
  const inlineData = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inlineData?.data) throw new ApiError(503, "TTS_UNAVAILABLE", "Gemini TTS returned no audio.");
  const pcm = Buffer.from(inlineData.data, "base64");
  return Buffer.concat([wavHeader(pcm.length, 24000, 1), pcm]);
}

// ---- WAV helpers (PCM16 mono) --------------------------------------------------------------
export function wavHeader(dataLength, sampleRate = SAMPLE_RATE, channels = 1) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + dataLength, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(dataLength, 40);
  return h;
}

export function parseWav(buf) {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("Not a WAV file");
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === "data") {
      data = buf.subarray(off + 8, Math.min(buf.length, off + 8 + size));
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("Malformed WAV");
  return { ...fmt, data };
}

export function silenceWav(seconds, sampleRate = SAMPLE_RATE) {
  const data = Buffer.alloc(Math.round(seconds * sampleRate) * 2);
  return Buffer.concat([wavHeader(data.length, sampleRate), data]);
}

// Placeholder speech-like audio: one soft tone burst per word, pitched per voice. Clearly not real speech.
function mockSynthesize(text, voiceId, language) {
  const voice = getVoice(voiceId);
  const wpm = (LANGUAGES[language] || LANGUAGES.ru).wordsPerMinute;
  const words = text.split(/\s+/).filter(Boolean);
  const perWord = 60 / wpm;
  const total = Math.max(0.3, words.length * perWord);
  const n = Math.round(total * SAMPLE_RATE);
  const data = Buffer.alloc(n * 2);
  const base = voice?.gender === "female" ? 210 : 120;
  let idx = 0;
  for (let w = 0; w < words.length; w++) {
    const len = Math.round(perWord * SAMPLE_RATE * 0.75);
    const gap = Math.round(perWord * SAMPLE_RATE * 0.25);
    const f = base * (1 + ((words[w].length % 5) - 2) * 0.04);
    for (let i = 0; i < len && idx < n; i++, idx++) {
      const env = Math.sin((Math.PI * i) / len);
      const t = idx / SAMPLE_RATE;
      const v = 0.18 * env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t) + 0.15 * Math.sin(2 * Math.PI * f * 3 * t));
      data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), idx * 2);
    }
    idx += gap;
  }
  return Buffer.concat([wavHeader(data.length), data]);
}

export async function synthesize({ text, voiceId, language, provider }) {
  const p = provider || (await resolveProvider());
  if (p === "mock") return mockSynthesize(text, voiceId, language);
  if (p === "gemini") return geminiSynthesize(text, voiceId, language);
  const parts = splitForTts(text);
  const bufs = [];
  for (const part of parts) bufs.push(await sileroSynthesize(part, voiceId));
  if (bufs.length === 1) return bufs[0];
  const parsed = bufs.map(parseWav);
  const data = Buffer.concat(parsed.map((x) => x.data));
  return Buffer.concat([wavHeader(data.length, parsed[0].sampleRate, parsed[0].channels), data]);
}
