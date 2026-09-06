// Structured API errors. Frontend maps `code` to UI (upgrade modal, toasts, etc).
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
  toJSON() {
    return { code: this.code, message: this.message, ...this.extra };
  }
}

export const limitReached = (type, message, extra = {}) =>
  new ApiError(402, "LIMIT_REACHED", message, { type, upgradeRequired: true, ...extra });

export const premiumRequired = (feature, requiredPlan, message) =>
  new ApiError(403, "PREMIUM_REQUIRED", message || `This feature requires the ${requiredPlan} plan.`, {
    feature,
    requiredPlan,
    upgradeRequired: true,
  });

export const unauthorized = (message = "Please sign in to continue.") => new ApiError(401, "UNAUTHORIZED", message);
export const notFound = (message = "Not found.") => new ApiError(404, "NOT_FOUND", message);
export const badRequest = (message, code = "BAD_REQUEST", extra = {}) => new ApiError(400, code, message, extra);

// Developer utilities are only reachable outside production, or when ENABLE_DEV_TOOLS=true is set explicitly.
export const DEV_TOOLS_ENABLED = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_TOOLS === "true";

export function jsonError(err) {
  if (err instanceof ApiError) return Response.json(err.toJSON(), { status: err.status });
  console.error(err);
  return Response.json({ code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }, { status: 500 });
}

// Wraps a route handler with unified error handling.
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return jsonError(err);
    }
  };
}
