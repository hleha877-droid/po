// The single gatekeeper for generation requests. Everything here reads from config/plans.js.
import { getPlan, LENGTHS, LANGUAGES, STYLES, minimumPlanFor } from "../config/plans.js";
import { getVoice } from "../config/voices.js";
import { getEffectiveSubscription } from "./subscriptionService.js";
import { getUsage } from "./usageService.js";
import { limitReached, premiumRequired, badRequest } from "../lib/errors.js";

export function formatMB(bytes) {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
}

export function estimateMinutesFromWords(words, language = "ru") {
  const wpm = (LANGUAGES[language] || LANGUAGES.ru).wordsPerMinute;
  return Math.round((words / wpm) * 100) / 100;
}

export function countWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

// Rough cost estimate (USD) used for internal reporting: LLM tokens + TTS compute.
export function estimateCost({ pages = 0, minutes = 0 }) {
  return Math.round((pages * 0.0006 + minutes * 0.004) * 10000) / 10000;
}

export async function getEntitlements(userId) {
  const sub = await getEffectiveSubscription(userId);
  const usage = await getUsage(userId);
  return { sub, planId: sub.effectivePlan, plan: sub.planConfig, usage };
}

/**
 * Validates a generation request before any AI work happens.
 * Checks: plan, monthly podcast count, monthly audio minutes (pre-estimate), PDF size,
 * PDF page count, style, length, voices, language.
 */
export async function assertCanGenerate(userId, req) {
  const { planId, plan, usage } = await getEntitlements(userId);
  const { style, length, language, voiceHost1, voiceHost2, fileSize, pages, count = 1 } = req;

  if (!STYLES[style]) throw badRequest("Unknown podcast style.");
  if (!LENGTHS[length]) throw badRequest("Unknown podcast length.");
  if (!LANGUAGES[language]) throw badRequest("Unsupported language.");

  // 1–2. Monthly podcast count
  if (usage.podcastsCreated + count > plan.monthlyPodcasts) {
    throw limitReached("podcasts", `You have reached your monthly podcast limit (${plan.monthlyPodcasts}).`, {
      used: usage.podcastsCreated,
      limit: plan.monthlyPodcasts,
    });
  }

  // 6. Style
  if (!plan.availableStyles.includes(style)) {
    throw premiumRequired("style", minimumPlanFor("availableStyles", style), `${STYLES[style].name} is available on the ${minimumPlanFor("availableStyles", style)} plan.`);
  }
  // Length
  if (!plan.availableLengths.includes(length)) {
    throw premiumRequired("length", minimumPlanFor("availableLengths", length), `${LENGTHS[length].name} podcasts are available on the ${minimumPlanFor("availableLengths", length)} plan.`);
  }
  // 8. Language
  if (!plan.availableLanguages.includes(language)) {
    throw premiumRequired("language", minimumPlanFor("availableLanguages", language), `${LANGUAGES[language].name} podcasts are available on the ${minimumPlanFor("availableLanguages", language)} plan.`);
  }
  // 7. Voices
  for (const v of [voiceHost1, voiceHost2].filter(Boolean)) {
    const voice = getVoice(v);
    if (!voice) throw badRequest(`Voice "${v}" is not available.`, "VOICE_UNAVAILABLE");
    if (voice.language !== language) throw badRequest(`Voice ${voice.name} does not speak ${LANGUAGES[language].name}.`, "VOICE_LANGUAGE_MISMATCH");
    if (!plan.availableVoices.includes(v)) {
      throw premiumRequired("voice", minimumPlanFor("availableVoices", v), `${voice.name} is a premium voice available on the ${minimumPlanFor("availableVoices", v)} plan.`);
    }
  }
  // Batch
  if (count > 1 && !plan.batchProcessing) {
    throw premiumRequired("batchProcessing", minimumPlanFor("batchProcessing"), "Batch PDF processing is available on the Creator plan.");
  }
  if (count > plan.maxBatchSize) throw badRequest(`You can process up to ${plan.maxBatchSize} PDFs at once.`, "BATCH_TOO_LARGE");

  // 4. File size
  if (fileSize > plan.maxFileSize) {
    throw limitReached("pdf_size", `This PDF is ${formatMB(fileSize)}. Your plan allows up to ${formatMB(plan.maxFileSize)}.`, {
      code: "PDF_TOO_LARGE",
      limit: plan.maxFileSize,
      actual: fileSize,
    });
  }
  // 5. Page count
  if (pages && pages > plan.maxPdfPages) {
    throw limitReached("pdf_pages", `This PDF has ${pages} pages. Your plan allows up to ${plan.maxPdfPages} pages.`, {
      code: "PDF_TOO_MANY_PAGES",
      limit: plan.maxPdfPages,
      actual: pages,
    });
  }

  // 3. Audio minutes — pre-estimate from the requested length (lower bound), enforced again after scripting.
  const minMinutes = LENGTHS[length].minMinutes * count;
  const remaining = plan.monthlyAudioMinutes - usage.audioMinutesGenerated;
  if (remaining <= 0) {
    throw limitReached("audio_minutes", "You have reached your monthly audio limit.", { code: "AUDIO_LIMIT_REACHED", used: usage.audioMinutesGenerated, limit: plan.monthlyAudioMinutes });
  }
  if (minMinutes > remaining) {
    throw limitReached("audio_minutes", `A ${LENGTHS[length].name} podcast needs about ${LENGTHS[length].minMinutes}+ minutes, but you only have ${Math.floor(remaining)} audio minutes left this month.`, {
      code: "AUDIO_LIMIT_REACHED",
      remaining,
      required: minMinutes,
    });
  }

  return { planId, plan, usage };
}

// Cost control right before TTS: the actual script estimate must fit the remaining allowance.
export async function assertAudioAllowance(userId, estimatedMinutes) {
  const { plan, usage } = await getEntitlements(userId);
  const remaining = plan.monthlyAudioMinutes - usage.audioMinutesGenerated;
  if (estimatedMinutes > remaining + 0.5) {
    throw limitReached("audio_minutes", `This podcast is estimated at ${Math.ceil(estimatedMinutes)} minutes but you have ${Math.max(0, Math.floor(remaining))} audio minutes left this month.`, {
      code: "AUDIO_LIMIT_REACHED",
      remaining,
      required: estimatedMinutes,
    });
  }
}

export function assertFeature(planId, feature, message) {
  const plan = getPlan(planId);
  if (!plan[feature]) throw premiumRequired(feature, minimumPlanFor(feature), message);
}
