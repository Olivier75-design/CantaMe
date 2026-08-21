# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

**The Git repository root is `cancion-tuya/`** — the Next.js app (`package.json`, `next.config.ts`, `src/` are all at the repo root, and this is what GitHub/Vercel see). Locally it lives inside a parent workspace folder `CantaMe/` that also contains `.mcp.json`, `Gemini.md`, and `output/` (none of which are part of the app or the repo). Run all `npm`/`git` commands from `cancion-tuya/`.

Repo: `github.com/Olivier75-design/CantaMe`, deploys to Vercel from `main`. Stack: **Next 16 (App Router) + React 19 + TypeScript**, Supabase (Postgres + Auth + Storage), Upstash Redis, Moneroo payments.

## Commands

```bash
npm run dev      # dev server (Next 16 + Turbopack). Wants :3000, but several ports
                 # are usually taken on this machine — read the port it prints.
                 # Next refuses a 2nd dev server on the same dir: if it exits with
                 # "Another next dev server is already running", kill that PID first.
npm run build    # production build — ALSO runs full TypeScript type-check (use this to validate types)
npm run lint     # eslint
npm run start    # serve the production build
npm run check:prompts  # the only automated test: asserts the MiniMax prompt invariants
```

There is no test *framework*, but `check:prompts` is a real regression test and is cheap to run — it caught a shipped bug (see Voice line-ups). Otherwise validate with `npm run build` (it type-checks) and exercise the flow in the running dev server. curl to external HTTPS is blocked on this machine (proxy/TLS) — to hit a local endpoint use PowerShell `Invoke-WebRequest -UseBasicParsing`, not curl.

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

**There is no preview, and nothing is free.** `POST /api/generate-song` composes the **real, full-length (~2 min) song the customer keeps**. Since the paywall it is **not** the metered action:
- **Not signed in → 401.** Guests cannot write lyrics or generate. `/api/generate-lyrics` 401s too (it costs OpenAI money and is step one of the same flow).
- **Signed in**: generates **without spending credits**, persists the order server-side, and returns `{ orderId, title, lyrics, locked: true }` — **never `audioUrl`**. Credits are spent later, to unlock.
- Generation is uncharged, so MiniMax is billed for abandons. Guarded by a per-account limit (10/hour) on top of the per-IP one (5/60s).

`PUT /api/orders/[id]` with `action:'generate_full'` no longer regenerates: it **reuses the audio already on the order** (regenerating produced a different melody than the one the customer heard — that mismatch was a real bug). It only composes as a fallback when an order somehow has no audio. Revisions (`action:'request_revision'`) *do* regenerate on purpose and cost `perRevision`. All generation routes set `runtime='nodejs'` + `maxDuration=300` → requires a Vercel **Pro** plan (Hobby's 60s cap fails the build).

**Prompt budgets — these directly control output quality** (`src/lib/musicPrompts.ts`):
- `buildStylePrompt(style, tone, voiceGender)` must stay **≲300 chars**. MiniMax dilutes longer prompts, and instructions near the end get dropped — a 364-char prompt is why the kids' choir came out inaudible. Put what matters (genre, then voices) early and keep `PRODUCTION_HINT` short.
- `buildLyricsMessages(brief, language, revisionNotes?)` — bilingual, revision-aware, and written as hit-songwriter craft rules (concrete imagery over stated emotion, one repeated hook carrying the name, banned clichés, fixed `[verse][chorus][verse][chorus][bridge][chorus]` structure).
- `fitLyricsToWindow()` in `generateSong.ts` caps lyrics at `LYRICS_MAX_CHARS` (1500), cutting at a **section boundary** — MiniMax silently truncates over-long lyrics mid-phrase, which sounds broken.

**Voice line-ups** — three keys (`female`, `male`, `duo`) that must stay in sync across **four** places: `VOICE_HINT` + `VOICE_LYRIC_HINT_*` (musicPrompts), `VOICE_ICONS` (constants), `form.voices` in **both** locale files, and the **Studio picker in `/admin`** (hardcoded `<option>`s). `npm run check:prompts` enforces the sync — run it after touching any of them.

The kids'-choir options (`femaleKids`, `maleKids`, `all`) were **removed**. Two reasons, both learned the hard way: (1) `all` glued a "verses = lead voice alone" clause onto a duet line-up, so the prompt contradicted itself and MiniMax collapsed it to a single singer — the customer picked "Everyone" and heard one voice; (2) the choir rule forced 4-6 word chorus lines and heavy repetition, flattening every hook into "Happy birthday, <name>!" four times. Old orders may still carry those values; `VOICE_HINT` falls back to `female`, which is intentional.

A prompt that **contradicts itself** is as damaging as one that is too long, and neither is visible in review — only audible in the product. `check-prompts.mjs` covers every voice × style × tone combination for both.

### Credits (the billing unit)
`src/lib/credits.ts`. Balances are stored in **Supabase Auth `app_metadata.credits`** (server-controlled — a user can't edit their own app_metadata; only the service_role key can), so there's no separate table. Internally billed in credits: **1 song = 20, 1 revision = 10** (`CREDITS` in `lib/constants.ts`); `freeOnSignup` is **0** — new accounts get nothing. Customers see everything in *songs*, not credits.

Credits are **granted** only by `creditForPayment()` after a verified payment — `GET /api/credits` (session-scoped) is read-only and there is intentionally **no POST** (a public "add credits" route would let anyone mint credits). They are **spent** by `POST /api/orders/[id]/unlock` to unlock a finished song (and on revisions), **not** by generation and not at checkout.

Packs (`CREDITS.packs`): **2 songs / $4, 7 / $11, 24 / $29** — round prices, and the counts follow a 100/80/60% discount curve on the entry unit price. Entry is $2.00/song against a MiniMax bill paid for every generation, converted or not: break-even at a 1-in-3 conversion is a generation cost under $0.66. Watch the invoice before discounting further.

### The paywall (listening AND downloading)
A generated song is **locked** until credits are spent on it. `orders.unlocked` is the flag; `POST /api/orders/[id]/unlock` spends `CREDITS.perSong`, is idempotent, and **refunds** if the write fails.

**`src/lib/orderAccess.ts` is the single gate** — `requireOwnedOrder()` / `requireUnlockedOrder()`. Every route that can emit song bytes goes through it, so there is one place to get this right instead of four.

⚠️ **The songs bucket is public, so the URL *is* the song.** The client must never receive `audio_url` for a locked order — that alone would make the paywall decorative. It is handed over only by the unlock response, after payment. `GET /api/orders/[id]/stream` exists but a plain `<audio>` sends cookies, not the Supabase bearer token, so it cannot drive playback; post-unlock the public URL is what the player uses.

`GET /api/orders/[id]/download` **now requires owner + unlocked** (it used to have no auth at all).

`GET /api/songs/download?url=&name=` is the older by-URL path:
- requires a valid Bearer token → **a plain `<a href>` cannot carry the Supabase JWT**, so the client must `fetch` with `authHeaders()` and hand the browser a blob (see `handleDownload` in `page.tsx` / `create/preview/page.tsx`);
- only accepts URLs under our own `…/storage/v1/object/public/songs/` prefix, otherwise it would be an open proxy (SSRF).

### Styling scale
`html { font-size: 13px }` in `globals.css` is **the one knob that resizes the whole site** — nearly everything, including the `--space-*` scale, is in `rem`. Note `--max-width` and the radii are in **px** and do *not* follow: dropping the root to 10px once left small text stranded in a 1200px shell with ~150-character lines, which read as cheap. Prose is capped at `65ch` for the same reason.

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
`src/lib/db.ts` — Supabase Postgres. Tables: `orders`, `revisions`, `music_styles`, `payments`, `page_views`, `contact_messages`, `song_ratings`. Columns are snake_case; `mapOrder`/`mapStyle`/`mapRevision` attach camelCase aliases so callers can read either (`audio_url` **or** `audioUrl`). `src/lib/supabase.ts`: `getSupabaseBrowser()` (anon, RLS applies) vs `getSupabaseServer()` (service_role, bypasses RLS) — both created lazily inside functions so importing them needs no env vars at build time.

⚠️ **`supabase-setup.sql` is applied by hand, not by a migration tool.** Adding a table or column to that file does **nothing** until someone pastes it into the Supabase SQL Editor. A feature whose section has not been run fails at runtime, not at build: expect `save_failed`/500s, an empty admin tab, or `Could not find the table 'public.X' in the schema cache` in the server log. Check this before debugging anything data-related that "should work". The `orders.unlocked` block is written as `default true` then flipped to `default false` on purpose — that keeps it idempotent, so re-running the file never re-locks existing songs.

**`supabase-setup.sql`** (run once in the Supabase SQL Editor) is the source of truth for the schema: creates the public `songs` bucket, adds `orders.lyrics`, the `payments` table (+ promo/amount/influencer columns), and `page_views`. RLS approach: setting `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS, so only the public-bucket section is strictly required; the storage/RLS policy sections are only needed if you run on the anon key.

### i18n
`src/context/LanguageContext.tsx` (`useLanguage`) — `t('a.b.c', { name })` looks up nested keys in `src/locales/es.json` / `en.json` with `{placeholder}` replacement. Default `es` (persisted in `localStorage['ct-lang']`). **Every user-facing string must exist in BOTH locale files with identical key paths** — a missing key makes `t()` return the raw key. Some components branch on language by comparing a translated value (e.g. `t('nav.login') === 'Log in'`); keep those exact strings intact.

### Styling
One global stylesheet `src/app/globals.css` with CSS custom properties in `:root` (light + blue theme, `--accent-primary: #2563EB`). No Tailwind / CSS modules; shared utility-ish classes (`.container`, `.card`, `.btn`, `.heading-lg`, spacing vars like `var(--space-lg)`) plus inline styles. On grid/flex, add `min-width: 0` / `minmax(0, 1fr)` to children to avoid mobile horizontal "blowout".

### Analytics
`page_views` is a server-side, ad-blocker-proof counter populated by `src/middleware.ts` (visible in Admin → Traffic). Vercel Analytics always runs; GA4 loads only when `NEXT_PUBLIC_GA_ID` is set (`components/GoogleAnalytics.tsx`).

### Song ratings (the quality feedback loop)
`src/lib/ratings.ts` + `components/SongRating.tsx` (👍/👎) + `POST /api/ratings` (public, IP-limited 20/60s) → **Admin → Quality**.

The point is that prompt changes used to ship with **no way to tell whether they made songs better**. Every vote snapshots the settings that produced the song (style, tone, voice, occasion, language), so "which styles actually land" is a query rather than a guess — `getRatingStats()` returns the overall score plus a breakdown per dimension, sorted by volume (a 100% score off one vote is noise). The admin surfaces a warning below ~20 ratings for the same reason.

Rated from three places: the home wizard after generation, `/create/preview`, and the dashboard player. Guests may rate — they generate songs too, and excluding them would discard most of the signal. Upserts on `audio_url` so re-rating updates the row instead of stacking duplicate votes. `song_ratings` is RLS-on/no-policies like `contact_messages`. Accepts only `audio_url`s from our own songs bucket, otherwise the table becomes a free-text dump and the stats stop meaning anything.

### Contact form
There is **no real mailbox** — `hello@cantame.app` never existed and was removed. Visitors write through a modal (`components/ContactModal.tsx`), mounted by `Footer` (which is in the root layout, so it is reachable everywhere). Anything can open it by calling the exported `openContactModal()`, which dispatches a `cantame:contact` window event — that's how `/privacy` and `/terms` reuse the one form without duplicating it.

`POST /api/contact` is public: IP rate limit (3 / 10 min), a hidden `website` **honeypot** (filled → return 200 and write nothing, so the bot doesn't retry), then server-side validation via `validateContactInput()` in `src/lib/contact.ts`. A signed-in sender's `user_id` is attached when a valid Bearer token comes along.

`contact_messages` has **RLS enabled with no policies** — unlike the other app tables, which carry permissive `using (true)` policies. That's deliberate: only the service_role key may read it, so visitor names/emails are not exposed to the browser even through the anon key. Don't add a policy to "fix" a read problem; use a server route.

Admin → **Messages** tab lists them (`GET /api/admin/contact`, `PATCH /api/admin/contact/[id]`), with an unread badge. The **Reply** button is a pre-filled `mailto:` — the admin answers from their own mailbox, which is why the app needs no SMTP or sending service (same constraint that makes sign-up use `admin.createUser`).

`src/lib/contact.ts` is **server-only** (it imports `getSupabaseServer()`); the shared `CONTACT_SUBJECTS` whitelist lives in `lib/constants.ts` so the client modal can render it — same split as `promo.ts` / `promoClient.ts`.

### Constants
`src/lib/constants.ts` — `OCCASIONS`, `MUSIC_STYLES` (id/icon/color/`nameKey`), `OCCASION_STYLE_MAP` ("Surprise Me"), `VOICE_ICONS` (shared by both wizards), `CREDITS` (pricing/packs — replaces the old subscription tiers), `GALLERY_SAMPLES`. Note `MUSIC_STYLES[].audioUrl` still points at **SoundHelix placeholder MP3s**, not real style samples.

## User flow & order lifecycle

**Two wizards exist and must be kept in step** — the home one (`/`, scrolls to `#studio`, steps 1-5 in `page.tsx`) and the multi-page `/create` → `/create/details` → `/create/preview`. They are near-duplicates, and drift between them has caused real bugs (the voice picker existed in only one of them). Header "Create My Song" and the dashboard both link to `/create`.

Flow: brief → editable lyrics (`/api/generate-lyrics`, public + IP-limited) → **the song itself** (`/api/generate-song`) → play it / download it (sign-in required) → sign in to save it. The brief travels in `sessionStorage['ct-order']`.

On the dashboard, a pending `ct-order` is turned into an order via `POST /api/orders` with the audio attached — and **`/api/checkout` is deliberately NOT called**, because the credit was already spent at generation (calling it would double-charge). `POST /api/orders` sets status **`READY`** when `audioUrl` points at our own storage bucket (validated prefix), else `PENDING_PAYMENT`.

A brief with **no audio** on the dashboard is only resumed at `/create/preview` when the user just came back from a credit purchase (`?paid=1`); otherwise it's stale junk and is discarded. Do not "helpfully" redirect here — `/create/preview` starts composing on mount, so redirecting a returning user there charges them 20 credits for a song they never asked for.

Orders link to the user by id/`client_email`; the dashboard loads them via `/api/orders?email=`. Revisions: `/order/[id]/review` → `PUT /api/orders/[id]`.

Order status: `PENDING_PAYMENT`, `IN_PRODUCTION`, `READY`, `REVISION_REQUESTED`, `DELIVERED`.

**Stale path to watch**: `/checkout`'s "use a credit" branch still creates an order and calls `/api/checkout` (spending credits) without generating anything. It's effectively unreachable now (users only land there with 0 credits, i.e. the *buy* branch), but it would double-charge if it were reached.

### Front-end gotchas that cost real debugging time
- **Generated MP3s report `duration = Infinity`** until the browser scans to the end, so timers show `0:00 / 0:00` and progress never advances. The dashboard player probes the real duration by seeking past the end once, then resetting (see `playIntentRef` / `probing`).
- **The song-language picker must stay above the "Suggest memory/message" fields.** Those suggestions are pulled from `TEMPLATES` in the *currently selected* language, so a picker placed after them yields suggestions in the wrong language.

## Vercel deployment gotchas (all have caused production 404s)

- **Framework Preset must be `Next.js`** (not `Other`) — with `Other`, builds go green but the site 404s.
- **Root Directory** must be empty / `./` (the app is at the repo root on GitHub).
- All env vars set; `NEXT_PUBLIC_*` must be present **before** the build.
- **Pro plan** required for `maxDuration = 300`.
- After changing any of the above, **redeploy** (env/preset changes only apply to a new build).
- **Domains**: this is a `.app` domain (HSTS-preloaded → HTTPS mandatory, no cert-error bypass). Keep **both** `cantame.app` and `www.cantame.app` added to the Vercel project with valid certs, or visitors hitting the un-provisioned variant are hard-blocked.

## Batch asset generation

`scripts/generate-gallery-songs.ps1` (PowerShell, reads `scripts/gallery-songs.json`) batch-generates the 12 gallery samples into `public/audio/g1..g12.mp3` via MiniMax `music-2.6`.
