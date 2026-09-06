"use client";
// Tiny fetch wrapper. Throws structured errors ({code, message, type, upgradeRequired, requiredPlan}).
export class ApiRequestError extends Error {
  constructor(status, body) {
    super(body?.message || "Request failed");
    this.status = status;
    this.code = body?.code || "UNKNOWN";
    this.body = body || {};
  }
}

export async function api(path, { method = "GET", body, formData, headers = {} } = {}) {
  const init = { method, headers: { ...headers }, credentials: "same-origin" };
  if (formData) init.body = formData;
  else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : null;
  if (!res.ok) throw new ApiRequestError(res.status, data || { message: res.statusText });
  return data;
}

export const UPGRADE_CODES = new Set(["LIMIT_REACHED", "PREMIUM_REQUIRED", "PDF_TOO_LARGE", "PDF_TOO_MANY_PAGES", "AUDIO_LIMIT_REACHED", "PLAN_LIMIT_REACHED"]);

export function isUpgradeError(err) {
  return err instanceof ApiRequestError && (UPGRADE_CODES.has(err.code) || err.body?.upgradeRequired);
}

export const ERROR_TITLES = {
  LIMIT_REACHED: "Monthly limit reached",
  PREMIUM_REQUIRED: "Premium feature",
  PDF_TOO_LARGE: "PDF is too large",
  PDF_TOO_MANY_PAGES: "Too many pages",
  AUDIO_LIMIT_REACHED: "Audio limit reached",
  PLAN_LIMIT_REACHED: "Plan limit reached",
  TTS_UNAVAILABLE: "Voice engine unavailable",
  AI_UNAVAILABLE: "AI temporarily unavailable",
  RATE_LIMITED: "Slow down a little",
  INVALID_PDF: "Invalid PDF",
  PDF_NO_TEXT: "No readable text",
  GENERATION_FAILED: "Generation failed",
};
