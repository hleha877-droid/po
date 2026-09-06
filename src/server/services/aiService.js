// LLM script generation via Gemini or OpenRouter, with a deterministic mock provider when no key is set.
import { STYLES, LENGTHS, LANGUAGES } from "../config/plans.js";
import { ApiError } from "../lib/errors.js";

export const AI_PROVIDER = process.env.GEMINI_API_KEY
  ? process.env.AI_PROVIDER || "gemini"
  : process.env.OPENROUTER_API_KEY
    ? process.env.AI_PROVIDER || "openrouter"
    : "mock";

const RU_STYLE_RULE =
  "Пиши сценарий для живого аудио, а не статью. Используй естественный разговорный русский без канцелярита, дословных переводов и искусственно правильных фраз. Чередуй короткие и средние предложения, иногда используй вопросы, уточнения и мягкие паузы через пунктуацию. Каждая реплика должна звучать так, будто ведущий произносит её вслух, а не читает отчёт. Не начинай соседние реплики одинаково. Не злоупотребляй словами «итак», «таким образом», «важно отметить», «следовательно», «в данном документе» и похожими шаблонами. Не добавляй факты, которых нет в исходном тексте.";
const EN_STYLE_RULE = "Write for the ear, not like an article. Use natural spoken English, varied sentence length, real questions and reactions, and avoid repeated transitions, corporate language and invented facts.";

const MODE_INSTRUCTIONS = {
  quick_summary: {
    ru: "Формат: КРАТКИЙ ОБЗОР. Один ведущий (HOST_1). Коротко и по делу: главная идея, 3–5 ключевых выводов, практический смысл, короткое завершение.",
    en: "Format: QUICK SUMMARY. One host (HOST_1). Concise: the main idea, 3–5 key takeaways, why it matters, short wrap-up.",
  },
  deep_dive: {
    ru: "Формат: ГЛУБОКОЕ ПОГРУЖЕНИЕ. Один ведущий (HOST_1). Подробно раскрой каждую важную идею документа, объясняй контекст, связи между частями, нюансы и примеры из текста.",
    en: "Format: DEEP DIVE. One host (HOST_1). Thoroughly explain every important idea, context, connections and nuances with examples from the text.",
  },
  two_hosts: {
    ru: "Формат: ДВА ВЕДУЩИХ. HOST_1 — спокойный объясняющий ведущий, HOST_2 — любопытный и немного критичный собеседник. Они должны отвечать именно на мысли друг друга: уточнять, не соглашаться, просить пример, замечать неожиданные последствия. Не используй пустые реплики вроде «интересно», «хороший вопрос» и «согласна» без развития мысли. Реплики короткие и разной длины, без длинных монологов. Чередуй говорящих, но не превращай разговор в механическое HOST_1 — HOST_2.",
    en: "Format: TWO HOSTS. HOST_1 and HOST_2 have a natural conversation: react to each other, clarify, build on points. Short lines, no monologues. Alternate speakers.",
  },
  study_mode: {
    ru: "Формат: УЧЕБНЫЙ РЕЖИМ. HOST_1 — терпеливый преподаватель, HOST_2 — любознательный студент, который иногда ошибается и просит объяснить проще. HOST_2 задаёт конкретные вопросы по предыдущей реплике, а HOST_1 отвечает с примером. Не повторяй определения дословно и не превращай урок в список. В конце каждого блока делай короткий живой рекап.",
    en: "Format: STUDY MODE. HOST_1 is a teacher, HOST_2 a curious student. Explain concepts, define key terms, give examples, ask the listener check questions (then answer them), recap key points after each block and at the end.",
  },
  debate_mode: {
    ru: "Формат: ДЕБАТЫ. HOST_1 объясняет позицию и аргументы документа. HOST_2 уважительно, но по-настоящему проверяет их: ищет слабое место, просит доказательство, показывает возможное ограничение и предлагает альтернативную трактовку. Каждая реплика должна двигать спор вперёд, а не повторять предыдущую. Дебаты строго в рамках фактов документа: не выдумывай статистику, источники или спорные утверждения. Заверши сбалансированным выводом.",
    en: "Format: DEBATE. HOST_1 explains the document's position and arguments. HOST_2 respectfully challenges assumptions, asks hard questions, points out limitations. IMPORTANT: the debate must stay strictly grounded in the document's facts. Do not invent controversial claims, statistics or sources absent from the text. Say so when the document doesn't cover something. End with a balanced conclusion.",
  },
};

function targetWords(length, language) {
  const l = LENGTHS[length] || LENGTHS.quick;
  const wpm = (LANGUAGES[language] || LANGUAGES.ru).wordsPerMinute;
  const midMinutes = (l.minMinutes + l.maxMinutes) / 2;
  return { minWords: Math.round(l.minMinutes * wpm), maxWords: Math.round(l.maxMinutes * wpm), targetWords: Math.round(midMinutes * wpm) };
}

export function chunksForLength(length) {
  return { quick: 2, standard: 4, deep: 6, long_form: 8 }[length] || 2;
}

function buildPrompt({ context, style, length, language, fileName }) {
  const lang = language === "en" ? "en" : "ru";
  const { minWords, maxWords, targetWords: tw } = targetWords(length, lang);
  const mode = MODE_INSTRUCTIONS[style] || MODE_INSTRUCTIONS.quick_summary;
  const hosts = STYLES[style]?.hosts || 1;
  const system =
    lang === "ru"
      ? `Ты — сценарист подкастов PodMind AI. Ты превращаешь документы в увлекательные аудиоподкасты. ${RU_STYLE_RULE} Никогда не упоминай, что ты ИИ. Не используй markdown, списки, заголовки и эмодзи — только реплики для озвучивания. Числа и аббревиатуры пиши так, как их произносят вслух.`
      : `You are the podcast scriptwriter of PodMind AI. You turn documents into engaging audio podcasts. ${EN_STYLE_RULE} Never mention you are an AI. No markdown, bullet points, headings or emoji — only spoken lines. Write numbers and abbreviations the way they are pronounced.`;
  const user =
    (lang === "ru"
      ? `Документ: "${fileName}".\n\n${mode.ru}\n\nЦелевая длина: примерно ${tw} слов (не меньше ${minWords}, не больше ${maxWords}). ${hosts === 2 ? "Используй ровно двух говорящих: HOST_1 и HOST_2." : "Используй только HOST_1."}\n\nВерни СТРОГО JSON без пояснений вида:\n{"title": "короткое цепляющее название подкаста", "description": "2–3 предложения описания", "lines": [{"speaker": "HOST_1", "text": "..."}]}\n\nИсходный текст документа:\n"""\n`
      : `Document: "${fileName}".\n\n${mode.en}\n\nTarget length: about ${tw} words (no fewer than ${minWords}, no more than ${maxWords}). ${hosts === 2 ? "Use exactly two speakers: HOST_1 and HOST_2." : "Use only HOST_1."}\n\nReturn STRICT JSON with no commentary:\n{"title": "short catchy podcast title", "description": "2–3 sentence description", "lines": [{"speaker": "HOST_1", "text": "..."}]}\n\nSource document text:\n"""\n`) +
    context +
    '\n"""';
  return { system, user, hosts, maxWords };
}

function parseScript(raw, hosts) {
  let text = String(raw || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model output");
  const obj = JSON.parse(text.slice(start, end + 1));
  const lines = (obj.lines || [])
    .map((l) => ({ speaker: l.speaker === "HOST_2" && hosts === 2 ? "HOST_2" : "HOST_1", text: String(l.text || "").trim() }))
    .filter((l) => l.text);
  if (!lines.length) throw new Error("Empty script");
  return { title: String(obj.title || "").slice(0, 140), description: String(obj.description || "").slice(0, 600), lines };
}

async function callOpenRouter({ system, user }) {
  const key = process.env.OPENROUTER_API_KEY;
  const models = [...new Set([process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini", process.env.OPENROUTER_FALLBACK_MODEL || "google/gemma-4-26b-a4b-it:free"])];
  let lastStatus = null;
  for (const model of models) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 180_000);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "PodMind AI",
        },
        body: JSON.stringify({ model, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.choices?.[0]?.message?.content || "";
      }
      lastStatus = res.status;
    } catch {
      lastStatus = null;
    } finally {
      clearTimeout(t);
    }
  }
  throw new ApiError(503, "AI_UNAVAILABLE", `The AI service is temporarily unavailable${lastStatus ? ` (${lastStatus})` : ""}. Please try again in a moment.`);
}

async function callGemini({ system, user }) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      const details = await res.json().catch(() => ({}));
      const message = details.error?.message || `Gemini returned ${res.status}`;
      throw new Error(message);
    }
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  } catch (error) {
    throw new ApiError(503, "AI_UNAVAILABLE", `Gemini is temporarily unavailable. ${error instanceof Error ? error.message : "Please try again later."}`);
  } finally {
    clearTimeout(t);
  }
}

// Deterministic extractive "writer" for development without an API key.
function mockScript({ context, style, length, language, fileName }) {
  const lang = language === "en" ? "en" : "ru";
  const hosts = STYLES[style]?.hosts || 1;
  const { targetWords: tw } = targetWords(length, lang);
  const sentences = context
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 400);
  const baseTitle = fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Документ";
  const intro =
    lang === "ru"
      ? [
          { speaker: "HOST_1", text: `Привет! Это PodMind. Сегодня разбираем документ «${baseTitle}». Давайте посмотрим, о чём он и что в нём самое важное.` },
          ...(hosts === 2 ? [{ speaker: "HOST_2", text: "Отличная тема. Мне уже интересно, с чего начнём?" }] : []),
        ]
      : [
          { speaker: "HOST_1", text: `Hi, this is PodMind. Today we're breaking down "${baseTitle}". Let's see what it's about and what really matters in it.` },
          ...(hosts === 2 ? [{ speaker: "HOST_2", text: "Great topic. So, where do we start?" }] : []),
        ];
  const connectors =
    lang === "ru"
      ? ["Смотрите, вот важный момент.", "Дальше в документе говорится вот что.", "И ещё одна мысль, которую стоит запомнить.", "Обратите внимание на такую деталь.", "Это подводит нас к следующему пункту."]
      : ["Here's an important point.", "Next, the document says this.", "And one more idea worth remembering.", "Notice this detail.", "That brings us to the next point."];
  const reactions =
    lang === "ru"
      ? ["Подожди, а это не противоречит тому, что было сказано в начале?", "Давай переведём эту мысль на обычный человеческий язык.", "Вот здесь я бы поспорила: какой вывод можно сделать на практике?", "Хорошо, теперь понятнее. Но что читателю важно запомнить?", "Любопытно. А где в документе это подтверждается?"]
      : ["Wait, doesn't that conflict with what we heard at the beginning?", "Let's translate that idea into plain language.", "I would push back here: what does this mean in practice?", "That makes more sense. What should the listener remember?", "Interesting. Where does the document support that claim?"];
  const hostPrompts =
    lang === "ru"
      ? ["Объясни это через простой пример.", "Сформулируй главный вывод одним предложением.", "Давай отделим факт из документа от нашей интерпретации.", "Что изменится для человека, который применит эту идею?"]
      : ["Explain that with a simple example.", "State the main takeaway in one sentence.", "Let's separate the document's fact from our interpretation.", "What changes for someone who applies this idea?"];
  const lines = [...intro];
  let words = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  let i = 0;
  while (words < tw && sentences.length) {
    const s = sentences[i % sentences.length];
    const text = `${connectors[i % connectors.length]} ${s}`;
    lines.push({ speaker: "HOST_1", text });
    words += text.split(/\s+/).length;
    if (hosts === 2) {
      const r = reactions[i % reactions.length];
      lines.push({ speaker: "HOST_2", text: r });
      lines.push({ speaker: "HOST_1", text: hostPrompts[i % hostPrompts.length] });
      words += r.split(/\s+/).length;
      words += hostPrompts[i % hostPrompts.length].split(/\s+/).length;
    }
    i++;
    if (i > sentences.length * 2) break;
  }
  lines.push({
    speaker: "HOST_1",
    text: lang === "ru" ? "На этом всё. Спасибо, что слушали PodMind. До встречи в следующем выпуске!" : "That's it for today. Thanks for listening to PodMind. See you in the next episode!",
  });
  return {
    title: lang === "ru" ? `${baseTitle}: главное за несколько минут` : `${baseTitle}: the essentials in minutes`,
    description:
      lang === "ru"
        ? `Аудиоразбор документа «${baseTitle}» в формате «${STYLES[style]?.name}». Ключевые идеи, выводы и практический смысл.`
        : `An audio breakdown of "${baseTitle}" in ${STYLES[style]?.name} format. Key ideas, conclusions and why they matter.`,
    lines,
  };
}

export async function generateScript(args) {
  const prompt = buildPrompt(args);
  if (AI_PROVIDER === "mock") return { ...mockScript(args), provider: "mock" };
  const call = AI_PROVIDER === "gemini" ? callGemini : callOpenRouter;
  let raw = await call(prompt);
  try {
    return { ...parseScript(raw, prompt.hosts), provider: AI_PROVIDER };
  } catch {
    raw = await call({ system: prompt.system, user: prompt.user + "\n\nВерни только валидный JSON. / Return only valid JSON." });
    try {
      return { ...parseScript(raw, prompt.hosts), provider: AI_PROVIDER };
    } catch {
      throw new ApiError(503, "AI_UNAVAILABLE", "The AI returned an unreadable script. Please try again.");
    }
  }
}
