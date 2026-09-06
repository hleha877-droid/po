# PodMind AI

PodMind AI transforms PDF documents into AI-generated podcasts.

```
PDF → AI analysis → Podcast script → AI voices (Silero) → MP3 (FFmpeg) → Listen / Download / Share
```

**Stack:** React 19 + Next.js (App Router, JavaScript only — no TypeScript), Node.js route handlers as the backend,
PostgreSQL via Drizzle ORM (Supabase-compatible schema + RLS policies in `sql/rls.sql`), Gemini (LLM + TTS),
optional Silero TTS (HTTP microservice in `tts-service/`), FFmpeg, Tailwind CSS, Framer Motion.

> The app was rebuilt inside a Next.js workspace, so the "Express backend" lives in `src/server/**` and
> `src/app/api/**` (route handlers) instead of a separate Express process. All business logic is framework-agnostic
> and can be mounted on Express unchanged.

---

## Quick start

```bash
npm install
cp .env .env.local   # optional: override values
npx drizzle-kit push # create tables in DATABASE_URL
npm run dev
```

### Deploy to Netlify

Import this repository in Netlify. The included `netlify.toml` configures the Next.js build automatically.
Add every variable from `.env.local` in **Site configuration → Environment variables**, but use a hosted PostgreSQL
URL instead of `127.0.0.1`. Run `npx drizzle-kit push` locally with that hosted `DATABASE_URL` before the first launch.

The default local storage driver is not persistent on Netlify. Use a persistent external storage driver before
production use, otherwise uploaded PDFs and generated audio can disappear between function invocations.

Optional services:

* **Gemini** – set `GEMINI_API_KEY`, `AI_PROVIDER=gemini` and `TTS_PROVIDER=gemini`. The free Gemini tier can be used for text and, where available for the selected model, speech generation; quota and regional availability are controlled by Google.
* **OpenRouter** – optional fallback provider; set `OPENROUTER_API_KEY` and `AI_PROVIDER=openrouter`.
* **Silero TTS** – run `tts-service/server.py` (`uvicorn server:app --port 8000`). If it is offline and
  `TTS_FALLBACK_MOCK=true`, placeholder audio is synthesized so the pipeline stays testable. Set
  `TTS_FALLBACK_MOCK=false` in production so real users never receive placeholder audio.
* **FFmpeg** – if `ffmpeg` is on `PATH` episodes are exported as MP3; otherwise a WAV is produced (the UI labels it).

### Environment

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
BILLING_PROVIDER=mock
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
YOOKASSA_CURRENCY=RUB
APP_URL=http://localhost:3000
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
TTS_PROVIDER=gemini
TTS_SERVICE_URL=http://localhost:8000
TTS_HOST1=aidar
TTS_HOST2=kseniya
PDF_CHUNK_SIZE=8000
STORAGE_PROVIDER=local
STORAGE_DIR=./storage
SESSION_SECRET=change-me
TTS_FALLBACK_MOCK=true      # false in production
ENABLE_DEV_TOOLS=true       # false in production (reset-usage endpoint)
```

---

## Project layout

```
src/server/config/plans.js          ← single source of truth for plans, limits & features
src/server/config/voices.js         ← voice catalog (only voices the TTS backend supports)
src/server/services/
  billingService.js                 ← provider abstraction (mock today, Stripe/etc. later)
  subscriptionService.js            ← effective plan resolution (renewals, cancellations)
  usageService.js                   ← monthly counters (podcasts, audio minutes)
  entitlementService.js             ← THE gatekeeper: every generation passes through here
  generationService.js              ← queue + pipeline (extract → write → voice → combine)
  aiService.js / ttsService.js / audioService.js / pdfService.js / storageService.js
src/server/lib/                     ← auth (sessions), rate limiting, structured errors
src/app/api/**                      ← REST endpoints
src/app/**                          ← pages (landing, pricing, dashboard, create, podcast, listen, settings)
src/components/**                   ← PremiumFeatureLock, UpgradeModal, UsageWidget, AudioPlayer, PricingCards…
sql/rls.sql                         ← Supabase Row Level Security policies
tts-service/server.py               ← Silero FastAPI microservice
```

---

## Subscription System

### Plans

| | **Free** | **Pro** — $7.99/mo (≈ ₽749) | **Creator** — $19.99/mo (≈ ₽1 890) |
|---|---|---|---|
| Podcasts / month | 5 | 50 | 200 |
| Audio minutes / month | 60 | 500 | 2 000 |
| PDF pages / size | 100 pages · 25 MB | 200 pages · 50 MB | 500 pages · 100 MB |
| Modes | Quick Summary | + Deep Dive, Two Hosts, Study, Debate | everything in Pro + Advanced Deep Dive |
| Lengths | Quick (5–10 min) | Quick, Standard, Deep | + Long-form (30–45 min) |
| Languages / voices | Russian · Aidar | RU + EN · all Silero voices | same + custom voice config |
| MP3 download / transcript export | – | ✓ | ✓ |
| Edit script & regenerate audio | – | ✓ | ✓ |
| Public `/listen/:id` pages | – | ✓ (no watermark) | ✓ + custom branding |
| Custom cover | – | ✓ | ✓ |
| Batch processing | – | – | up to 5 PDFs, sequential |
| Priority processing | – | ✓ | ✓ |

Everything above is defined **once** in `src/server/config/plans.js`. `GET /api/plans` serves the same object
to the frontend, so pricing cards, the comparison table, lock badges and the upgrade modal never duplicate logic.
Use `can(plan, feature)`, `limitFor(plan, key)` and `minimumPlanFor(feature)` — never hardcode plan names.

### Usage limits & cost control

Before any AI work starts, `entitlementService.assertCanGenerate()` checks, in order:

1. effective subscription plan  2. monthly podcast count  3. monthly audio minutes (lower-bound estimate of the
requested length)  4. PDF file size  5. **real page count** (parsed, never inferred from size)  6. style
7. voices  8. language (+ batch size).

After the script is written but **before TTS**, the expected duration is estimated from the word count
(`~125 wpm` RU / `150 wpm` EN) and checked against the remaining allowance (`assertAudioAllowance`). If it does not
fit, generation stops and the podcast is marked failed with `AUDIO_LIMIT_REACHED` — no TTS cost is incurred.

Violations return structured errors and never start generation:

```json
{ "code": "LIMIT_REACHED", "type": "audio_minutes", "message": "You have reached your monthly audio limit.", "upgradeRequired": true }
```

Other codes: `PREMIUM_REQUIRED` (with `requiredPlan`), `PDF_TOO_LARGE`, `PDF_TOO_MANY_PAGES`,
`AUDIO_LIMIT_REACHED`, `TTS_UNAVAILABLE`, `AI_UNAVAILABLE`, `RATE_LIMITED`. The frontend maps upgrade-type errors to
the **Upgrade modal** and everything else to toasts (`AppProvider.handleError`).

Usage is tracked per user per month in the `usage` table: `podcasts_created` increments when a podcast is accepted,
`audio_minutes_generated` increments with the **actual** rendered duration (regenerations count again).

### Mock billing

`BILLING_PROVIDER=mock` enables a development provider that simulates checkout, upgrade, downgrade, cancel and
renew instantly and writes an audit trail to `billing_events`. **No money moves and no payment is claimed** — the
UI shows a "Mock billing mode" banner and toast notes whenever it is active. The mock provider refuses to run unless
`BILLING_PROVIDER` is explicitly `mock`, so a production deployment configured for a real provider never falls back
to it.

Testing flows (all in *Settings → Billing* or via the API):

* `POST /api/billing/checkout {planId}` – upgrade (Free → Pro/Creator)
* `POST /api/billing/change-plan {planId}` – upgrade / downgrade / renew after cancel
* `POST /api/billing/cancel` – cancel at period end (features stay until `current_period_end`, then Free)
* `GET  /api/billing/subscription`, `GET /api/billing/history`, `GET /api/usage`, `GET /api/plans`
* `POST /api/dev/reset-usage` – dev-only usage reset (404 in production unless `ENABLE_DEV_TOOLS=true`)

### Replacing mock billing with a real provider

`src/server/services/billingService.js` exposes five functions and selects a provider object by
`BILLING_PROVIDER`:

```js
createCheckoutSession({ user, planId, returnUrl }) // return { url } to a hosted checkout
getSubscription(userId)
cancelSubscription(userId)
changePlan(userId, planId)
handleWebhook(rawBody, headers)                    // verify signature, then update `subscriptions`
```

To add Stripe: fill in the `stripeProvider` stub (create a Checkout Session with `price` ids mapped from
`PLANS[planId]`, store `provider_customer_id` / `provider_subscription_id`, and in `handleWebhook` update `plan`,
`status`, `current_period_start/end` on `customer.subscription.*` events). Point the provider's webhook at
`POST /api/billing/webhook`, set `BILLING_PROVIDER=stripe`, and nothing else in the app changes — plan resolution,
limits and UI all read from `subscriptions` + `plans.js`.

### Operational costs

Even with "free" components, running PodMind costs money: the LLM (OpenRouter) bills per token, self-hosted
Silero TTS needs CPU/GPU time (roughly real-time on CPU), FFmpeg/storage/bandwidth scale with audio minutes, and
Postgres/storage need hosting. The plan limits (podcasts and audio minutes) exist to cap that exposure; the
`generation_cost_estimate` column records a rough per-podcast estimate for reporting.

---

## Security

* Sessions are HttpOnly cookies; passwords are bcrypt-hashed. The backend resolves plan, usage and permissions on
  every request — plan info from the client is never trusted.
* Storage is private. Audio/covers are served via `/api/media/:id/*` with short-lived HMAC-signed tokens
  (owner or public podcasts only); downloads via `/api/podcasts/:id/download` require ownership **and** a plan with
  downloads. Cross-user access returns 404.
* `sql/rls.sql` contains Supabase RLS policies: users see only their own profiles, subscriptions, usage, podcasts and
  billing events; anonymous readers may only select podcasts that are `visibility = 'public'`.
* In-memory rate limiting (`src/server/lib/rateLimit.js`): unauthenticated 60/min per IP, auth endpoints 20/15 min,
  authenticated API 120/min, generation starts 12/hour, regenerations 20/hour.

## API

```
POST /api/auth/register | login | logout      GET /api/auth/me
GET  /api/plans                              GET /api/usage                GET /api/voices, /api/voices/preview
GET  /api/billing/subscription  POST /api/billing/checkout | change-plan | cancel | webhook  GET /api/billing/history
GET/POST /api/podcasts          GET/PATCH/DELETE /api/podcasts/:id       GET /api/podcasts/:id/status
POST /api/podcasts/:id/regenerate-audio     POST/DELETE /api/podcasts/:id/cover
GET  /api/podcasts/:id/download             GET /api/podcasts/:id/transcript
GET  /api/media/:id/audio (Range)           GET /api/media/:id/cover     GET /api/listen/:id
PATCH /api/settings             GET /api/system            POST /api/dev/reset-usage (dev only)
```
