# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

**The Git repository root is `cancion-tuya/`** — the Next.js app (`package.json`, `next.config.ts`, `src/` are all at the repo root, and this is what GitHub/Vercel see). Locally it lives inside a parent workspace folder `CantaMe/` that also contains `.mcp.json`, `Gemini.md`, and `output/` (none of which are part of the app or the repo). Run all `npm`/`git` commands from `cancion-tuya/`.

Repo: `github.com/Olivier75-design/CantaMe`, deploys to Vercel from `main`. Stack: **Next 16 (App Router) + React 19 + TypeScript**, Supabase (Postgres + Auth + Storage), Upstash Redis, Moneroo payments.

## Commands

```bash
npm run dev      # dev server (Next 16 + Turbopack). Defaults to :3000;
                 # on this machine :3000 is taken by another project, so it serves :3001
npm run build    # production build — ALSO runs full TypeScript type-check (use this to validate types)
npm run lint     # eslint
npm run start    # serve the production build
```

There is no test framework configured. To validate a change, run `npm run build` (it type-checks) and exercise the flow in the running dev server. curl to external HTTPS is blocked on this machine (proxy/TLS) — to hit a local endpoint use PowerShell `Invoke-WebRequest -UseBasicParsing`, not curl.

The `cancion-tuya:verify` and `cancion-tuya:security-review` skills are the preferred pre-commit checks (build + i18n key parity + secret scan; security review).

## Environment variables

In `.env.local` (gitignored; `.env.example` is the authoritative list). All must also be set in Vercel. `NEXT_PUBLIC_*` are baked in at **build** time — they must exist before the Vercel build. Many features degrade gracefully when their key is absent (see notes):

- `MINIMAX_API_KEY`, `MINIMAX_API_HOST` — server, MiniMax **music** generation (and lyrics fallback).
- `OPENAI_API_KEY`, `OPENAI_MODEL` — server, **lyrics** (preferred over MiniMax when set; model defaults to `gpt-4o-mini`).
- `MONEROO_SECRET_KEY`, `MONEROO_WEBHOOK_SECRET`, `MONEROO_CURRENCY` — payments. Webhook fails **closed** if the secret is missing.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — shared rate-limit store. Without them, rate limiting falls back to a weaker per-instance in-memory limiter.
- `NEXT_PUBLIC_SITE_URL` — canonical origin for OAuth redirects (see `lib/site.ts`). No trailing slash.
- `NEXT_PUBLIC_ADMIN_EMAILS` — comma-separated admin allowlist. **Fail closed**: empty = nobody is admin.
- `NEXT_PUBLIC_GA_ID` — optional GA4 id.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client Supabase (RLS applies).
- `SUPABASE_SERVICE_ROLE_KEY` — server only; **bypasses RLS** (new `sb_secret_...` format). `getSupabaseServer()` silently falls back to the anon key if this is missing/placeholder, which then fails Storage/admin operations.

## Architecture

### Song generation
Core is `src/lib/generateSong.ts` — `generateSongFile(input)`:
1. **Lyrics** via `src/lib/lyrics.ts` `writeLyrics()` — uses **OpenAI** (`gpt-4o-mini`, JSON mode) when `OPENAI_API_KEY` is set, else falls back to **MiniMax-Text-01**. Both are asked to return strict JSON `{title, lyrics}`.
2. **Music** via MiniMax `music-2.6` (`/v1/music_generation`) — returns **hex-encoded** mp3 (decoded to a Buffer).
3. Audio uploaded to Supabase Storage bucket `songs` (must be **public** for playback); returns public URL + `{title, lyrics}`.

Prompts live in `src/lib/musicPrompts.ts`: `buildStylePrompt(style, tone, voiceGender)` and `buildLyricsMessages(brief, language, revisionNotes?)` (bilingual, revision-aware).

**Preview vs full song** (important): the guest wizard preview generates a short **teaser** (`preview: true`) for speed — this is **free** and rate-limited by IP (`POST /api/generate-song`, 5/60s). The **full-length** song is generated **in the background after purchase** via `PUT /api/orders/[id]` with `action: 'generate_full'` — that path is authenticated, idempotent (returns early if already `READY`), does **not** re-charge credits, and composes from the exact (possibly user-edited) lyrics stored on the order. Revisions also go through `PUT /api/orders/[id]`. All generation routes set `runtime='nodejs'` + `maxDuration=300` → requires a Vercel **Pro** plan (Hobby's 60s cap fails the build).

### Credits (the billing unit)
`src/lib/credits.ts`. Balances are stored in **Supabase Auth `app_metadata.credits`** (server-controlled — a user can't edit their own app_metadata; only the service_role key can), so there's no separate table. Internally billed in credits: **1 song = 20, 1 revision = 10** (`CREDITS` in `lib/constants.ts`); new accounts get **20 free (= 1 song)** auto-initialized on first read. Customers see everything in *songs*, not credits. Credits are granted **only** by `creditForPayment()` after a verified payment — `GET /api/credits` (session-scoped) is read-only and there is intentionally **no POST** (a public "add credits" route would let anyone mint credits).

### Payments (Moneroo — real, not mock)
`src/lib/moneroo.ts` + routes under `src/app/api/payments/*`, `src/app/payments/callback`, `src/app/api/webhooks/moneroo`.
- `POST /api/payments/create` — resolves the pack **price + credits server-side from `packId`** (never trusts the client), applies a promo to the **price only**, calls Moneroo `initialize` for a hosted checkout, and records a **pending `payments` row**. Returns `checkoutUrl`.
- Crediting is **idempotent**: `creditForPayment()` verifies with Moneroo, then atomically claims the row (`pending → completed`) so only the first caller grants credits. Fired by **both** the return callback and the webhook — never by the client redirect alone.
- The webhook (`/api/webhooks/moneroo`) verifies `X-Moneroo-Signature` = HMAC-SHA256(rawBody, `MONEROO_WEBHOOK_SECRET`) with `timingSafeEqual`, and **fails closed** (503) if the secret is unset.

### Promo codes (server-only)
`src/lib/promo.ts` — `PROMO_CODES` list (e.g. `CANTA40` = 40% off). **Never import this from client code** (keeps the code list non-enumerable); the client uses `promoClient.ts` / `POST /api/promo/validate`. `applyPromo()` discounts the **price only**, never the credits granted, with a `MIN_PRICE` floor. The `influencer` label is stored on the payment row + Moneroo metadata for commission tracking.

### Auth & authorization
`src/context/AuthContext.tsx` (`useAuth`) — Supabase Auth. Because no SMTP is configured, sign-up does NOT use client `auth.signUp`; it POSTs to `/api/auth/signup`, which uses `admin.createUser({ email_confirm: true })` to create an already-confirmed account (handling "already exists" via `admin.listUsers`/`updateUserById`), then the client does `signInWithPassword`. `signIn` self-heals on "Email not confirmed" by calling that route and retrying once.

**Server-side authz pattern** (`src/lib/admin.ts`): `getUserFromRequest()` validates the `Authorization: Bearer <jwt>` via `supabase.auth.getUser()` — **derive the user id from this, never from the request body**. Ownership is checked with `ownsOrder()`. Admin routes call `verifyAdminRequest()` (allowlist via `NEXT_PUBLIC_ADMIN_EMAILS`, verified server-side even though the flag is `NEXT_PUBLIC` for UI hiding). `/admin` + `/api/admin/*` are the admin surface.

### Rate limiting
`src/lib/rateLimit.ts` — `rateLimit(id, max, windowSec)` using Upstash Redis sliding window (shared across serverless instances) with an in-memory per-instance fallback. `clientIp(request)` reads `x-forwarded-for`. Applied on public/paid routes (e.g. generate-song by IP, payments/create by user id).

### Data layer & DB
`src/lib/db.ts` — Supabase Postgres. Tables: `orders`, `revisions`, `music_styles`, `payments`, `page_views`. Columns are snake_case; `mapOrder`/`mapStyle`/`mapRevision` attach camelCase aliases so callers can read either (`audio_url` **or** `audioUrl`). `src/lib/supabase.ts`: `getSupabaseBrowser()` (anon, RLS applies) vs `getSupabaseServer()` (service_role, bypasses RLS) — both created lazily inside functions so importing them needs no env vars at build time.

**`supabase-setup.sql`** (run once in the Supabase SQL Editor) is the source of truth for the schema: creates the public `songs` bucket, adds `orders.lyrics`, the `payments` table (+ promo/amount/influencer columns), and `page_views`. RLS approach: setting `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS, so only the public-bucket section is strictly required; the storage/RLS policy sections are only needed if you run on the anon key.

### i18n
`src/context/LanguageContext.tsx` (`useLanguage`) — `t('a.b.c', { name })` looks up nested keys in `src/locales/es.json` / `en.json` with `{placeholder}` replacement. Default `es` (persisted in `localStorage['ct-lang']`). **Every user-facing string must exist in BOTH locale files with identical key paths** — a missing key makes `t()` return the raw key. Some components branch on language by comparing a translated value (e.g. `t('nav.login') === 'Log in'`); keep those exact strings intact.

### Styling
One global stylesheet `src/app/globals.css` with CSS custom properties in `:root` (light + blue theme, `--accent-primary: #2563EB`). No Tailwind / CSS modules; shared utility-ish classes (`.container`, `.card`, `.btn`, `.heading-lg`, spacing vars like `var(--space-lg)`) plus inline styles. On grid/flex, add `min-width: 0` / `minmax(0, 1fr)` to children to avoid mobile horizontal "blowout".

### Analytics
`page_views` is a server-side, ad-blocker-proof counter populated by `src/middleware.ts` (visible in Admin → Traffic). Vercel Analytics always runs; GA4 loads only when `NEXT_PUBLIC_GA_ID` is set (`components/GoogleAnalytics.tsx`).

### Constants
`src/lib/constants.ts` — `OCCASIONS`, `MUSIC_STYLES` (id/icon/color/`nameKey`), `OCCASION_STYLE_MAP` ("Surprise Me"), `CREDITS` (pricing/packs — replaces the old subscription tiers), `GALLERY_SAMPLES`.

## User flow & order lifecycle

Brief is collected via the home wizard (`/`, scrolls to `#studio`) or the multi-step `/create` → `/create/details` → `/create/preview` pages → a **real** teaser preview via `/api/generate-song` → pick a pack → `/signin` (auth) → **Moneroo** hosted checkout (`/api/payments/create` → `/payments/callback`) → credits granted → full song generated in background (`PUT /api/orders/[id]` `generate_full`) → `/dashboard`. Orders link to the user by id/`client_email`; the dashboard loads them via `/api/orders?email=`. Revisions: `/order/[id]/review` → `PUT /api/orders/[id]`. The in-progress brief is passed between steps in `sessionStorage['ct-order']`.

Order status: `PENDING_PAYMENT` → (payment) `READY`. Others: `IN_PRODUCTION`, `REVISION_REQUESTED`, `DELIVERED`.

## Vercel deployment gotchas (all have caused production 404s)

- **Framework Preset must be `Next.js`** (not `Other`) — with `Other`, builds go green but the site 404s.
- **Root Directory** must be empty / `./` (the app is at the repo root on GitHub).
- All env vars set; `NEXT_PUBLIC_*` must be present **before** the build.
- **Pro plan** required for `maxDuration = 300`.
- After changing any of the above, **redeploy** (env/preset changes only apply to a new build).
- **Domains**: this is a `.app` domain (HSTS-preloaded → HTTPS mandatory, no cert-error bypass). Keep **both** `cantame.app` and `www.cantame.app` added to the Vercel project with valid certs, or visitors hitting the un-provisioned variant are hard-blocked.

## Batch asset generation

`scripts/generate-gallery-songs.ps1` (PowerShell, reads `scripts/gallery-songs.json`) batch-generates the 12 gallery samples into `public/audio/g1..g12.mp3` via MiniMax `music-2.6`.
