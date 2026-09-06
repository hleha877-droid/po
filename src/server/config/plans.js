// Centralized subscription configuration.
// Every feature check in the app (backend + frontend presentation) derives from this file.
// Never hardcode plan checks elsewhere — use `can()`, `limitFor()`, `getPlan()`.

export const PLAN_ORDER = ["FREE", "PRO", "CREATOR"];

export const STYLES = {
  quick_summary: { id: "quick_summary", name: "Quick Summary", description: "Short, concise overview of the document.", hosts: 1, icon: "⚡" },
  deep_dive: { id: "deep_dive", name: "Deep Dive", description: "Detailed walkthrough of every important idea.", hosts: 1, icon: "🌊" },
  two_hosts: { id: "two_hosts", name: "Two Hosts", description: "Two AI hosts discuss the document naturally.", hosts: 2, icon: "🎙️" },
  study_mode: { id: "study_mode", name: "Study Mode", description: "Concepts, definitions, examples, questions and recaps.", hosts: 2, icon: "📚" },
  debate_mode: { id: "debate_mode", name: "Debate Mode", description: "One host explains, the other challenges — grounded in the source.", hosts: 2, icon: "⚖️" },
};

export const LENGTHS = {
  quick: { id: "quick", name: "Quick", range: "5–10 min", minMinutes: 5, maxMinutes: 10 },
  standard: { id: "standard", name: "Standard", range: "10–20 min", minMinutes: 10, maxMinutes: 20 },
  deep: { id: "deep", name: "Deep", range: "20–30 min", minMinutes: 20, maxMinutes: 30 },
  long_form: { id: "long_form", name: "Long-form", range: "30–45 min", minMinutes: 30, maxMinutes: 45 },
};

export const LANGUAGES = {
  ru: { id: "ru", name: "Русский", flag: "🇷🇺", wordsPerMinute: 125 },
  en: { id: "en", name: "English", flag: "🇬🇧", wordsPerMinute: 150 },
};

const MB = 1024 * 1024;

export const PLANS = {
  FREE: {
    id: "FREE",
    name: "Free",
    tagline: "Try PodMind for free",
    price: 0,
    currency: "USD",
    interval: "month",
    approxLocal: { currency: "RUB", symbol: "₽", amount: 0 },
    badge: null,
    cta: "Try Free",
    monthlyPodcasts: 5,
    monthlyAudioMinutes: 60,
    maxPdfPages: 100,
    maxFileSize: 25 * MB,
    maxCoverSize: 0,
    availableStyles: ["quick_summary"],
    availableLengths: ["quick"],
    availableLanguages: ["ru"],
    availableVoices: ["aidar"],
    premiumVoices: false,
    downloads: false,
    customCover: false,
    publicSharing: false,
    batchProcessing: false,
    maxBatchSize: 1,
    priorityProcessing: false,
    branding: false, // custom branding on public pages
    watermark: true,
    fullTranscript: false,
    editScript: false,
    regenerateAudio: false,
    features: [
      "5 podcasts per month",
      "60 AI-generated audio minutes per month",
      "PDF up to 100 pages",
      "Maximum PDF size: 25MB",
      "Quick Summary mode",
      "Standard Russian voice",
      "Online listening",
      "Basic transcript",
      "Podcast history",
    ],
    limitations: ["No public sharing", "No custom cover", "No advanced podcast modes"],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    tagline: "For people who learn a lot",
    price: 7.99,
    currency: "USD",
    interval: "month",
    approxLocal: { currency: "RUB", symbol: "₽", amount: 749 },
    badge: "MOST POPULAR",
    cta: "Start Pro",
    monthlyPodcasts: 50,
    monthlyAudioMinutes: 500,
    maxPdfPages: 200,
    maxFileSize: 50 * MB,
    maxCoverSize: 5 * MB,
    availableStyles: ["quick_summary", "deep_dive", "two_hosts", "study_mode", "debate_mode"],
    availableLengths: ["quick", "standard", "deep"],
    availableLanguages: ["ru", "en"],
    availableVoices: ["aidar", "kseniya", "baya", "xenia", "eugene", "en_0", "en_1"],
    premiumVoices: true,
    downloads: true,
    customCover: true,
    publicSharing: true,
    batchProcessing: false,
    maxBatchSize: 1,
    priorityProcessing: true,
    branding: false,
    watermark: false,
    fullTranscript: true,
    editScript: true,
    regenerateAudio: true,
    features: [
      "50 podcasts per month",
      "500 AI-generated audio minutes per month",
      "PDF up to 200 pages",
      "Maximum PDF size: 50MB",
      "Quick Summary, Deep Dive, Two Hosts",
      "Study Mode and Debate Mode",
      "Multiple languages and voices",
      "Premium Russian voices",
      "MP3 downloads",
      "Full transcripts",
      "Custom podcast cover",
      "Regenerate audio and edit generated script",
      "Public podcast links",
      "Priority generation",
      "No PodMind watermark",
    ],
    limitations: [],
  },
  CREATOR: {
    id: "CREATOR",
    name: "Creator",
    tagline: "For power users and publishers",
    price: 19.99,
    currency: "USD",
    interval: "month",
    approxLocal: { currency: "RUB", symbol: "₽", amount: 1890 },
    badge: "FOR POWER USERS",
    cta: "Start Creating",
    monthlyPodcasts: 200,
    monthlyAudioMinutes: 2000,
    maxPdfPages: 500,
    maxFileSize: 100 * MB,
    maxCoverSize: 5 * MB,
    availableStyles: ["quick_summary", "deep_dive", "two_hosts", "study_mode", "debate_mode"],
    availableLengths: ["quick", "standard", "deep", "long_form"],
    availableLanguages: ["ru", "en"],
    availableVoices: ["aidar", "kseniya", "baya", "xenia", "eugene", "en_0", "en_1"],
    premiumVoices: true,
    downloads: true,
    customCover: true,
    publicSharing: true,
    batchProcessing: true,
    maxBatchSize: 5,
    priorityProcessing: true,
    branding: true,
    watermark: false,
    fullTranscript: true,
    editScript: true,
    regenerateAudio: true,
    features: [
      "200 podcasts per month",
      "2,000 AI-generated audio minutes per month",
      "PDF up to 500 pages",
      "Maximum PDF size: 100MB",
      "Everything in Pro",
      "Advanced Deep Dive and long-form podcasts",
      "Multiple speaker styles and advanced voice selection",
      "Custom voice configuration where supported",
      "Batch PDF processing (up to 5 files)",
      "Export MP3 and transcript",
      "Public podcast pages with custom branding",
      "Priority processing and advanced podcast controls",
      "Higher generation limits",
    ],
    limitations: [],
  },
};

// Feature comparison rows used by /pricing and the landing page.
export const COMPARISON = [
  { key: "monthlyPodcasts", label: "Podcast limit", format: (v) => `${v} / month` },
  { key: "monthlyAudioMinutes", label: "Audio minutes", format: (v) => `${v.toLocaleString("en-US")} min` },
  { key: "maxPdfPages", label: "PDF pages", format: (v) => `up to ${v}` },
  { key: "two_hosts", label: "Two Hosts", style: true },
  { key: "deep_dive", label: "Deep Dive", style: true },
  { key: "study_mode", label: "Study Mode", style: true },
  { key: "debate_mode", label: "Debate Mode", style: true },
  { key: "premiumVoices", label: "Premium voices" },
  { key: "downloads", label: "MP3 download" },
  { key: "publicSharing", label: "Public sharing" },
  { key: "customCover", label: "Custom cover" },
  { key: "batchProcessing", label: "Batch processing" },
  { key: "branding", label: "Custom branding" },
];

export function getPlan(planId) {
  return PLANS[planId] || PLANS.FREE;
}

export function planRank(planId) {
  const i = PLAN_ORDER.indexOf(planId);
  return i === -1 ? 0 : i;
}

// Returns the minimum plan that unlocks a boolean feature or a specific style/length/language/voice.
export function minimumPlanFor(feature, value) {
  for (const id of PLAN_ORDER) {
    const p = PLANS[id];
    if (value === undefined) {
      if (p[feature]) return id;
    } else if (Array.isArray(p[feature]) && p[feature].includes(value)) {
      return id;
    }
  }
  return null;
}

export function can(planId, feature, value) {
  const p = getPlan(planId);
  if (value === undefined) return Boolean(p[feature]);
  return Array.isArray(p[feature]) && p[feature].includes(value);
}

export function limitFor(planId, key) {
  return getPlan(planId)[key];
}

// Serializable version for GET /api/plans (functions stripped).
export function serializePlans() {
  const plans = {};
  for (const id of PLAN_ORDER) plans[id] = { ...PLANS[id] };
  const comparison = COMPARISON.map((row) => {
    const values = {};
    for (const id of PLAN_ORDER) {
      const p = PLANS[id];
      if (row.style) values[id] = p.availableStyles.includes(row.key);
      else if (row.format) values[id] = row.format(p[row.key]);
      else values[id] = Boolean(p[row.key]);
    }
    return { key: row.key, label: row.label, values };
  });
  return { order: PLAN_ORDER, plans, comparison, styles: STYLES, lengths: LENGTHS, languages: LANGUAGES };
}
