# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

**The Git repository root is `cancion-tuya/`** — the Next.js app (`package.json`, `next.config.ts`, `src/` are all at the repo root, and this is what GitHub/Vercel see). Locally it lives inside a parent workspace folder `CantaMe/` that also contains `.mcp.json`, `Gemini.md`, and `output/` (none of which are part of the app or the repo). Run all `npm`/`git` commands from `cancion-tuya/`.

Repo: `github.com/Olivier75-design/CantaMe`, deploys to Vercel from `main`.

## Commands

```bash
npm run dev      # dev server (Next 16 + Turbopack). Defaults to :3000;
                 # on this machine :3000 is taken by another project, so it serves :3001
npm run build    # production build — ALSO runs full TypeScript type-check (use this to validate types)
npm run lint     # eslint
npm run start    # serve the production build
```

There is no test framework configured. To validate a change, run `npm run build` (it type-checks) and exercise the flow in the running dev server. curl to external HTTPS is blocked on this machine (proxy/TLS) — to hit a local endpoint use PowerShell `Invoke-WebRequest -UseBasicParsing`, not curl.

## Environment variables

In `.env.local` (gitignored; `.env.example` documents the set). All five are also required in Vercel:

- `MINIMAX_API_KEY`, `MINIMAX_API_HOST` — server-side, MiniMax generation
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client (baked in at **build** time — must exist before the Vercel build)
- `SUPABASE_SERVICE_ROLE_KEY` — server only; bypasses RLS. Format is the new `sb_secret_...` key. `getSupabaseServer()` silently falls back to the anon key if this is missing/placeholder, which then fails Storage/admin operations.

## Architecture

**Song generation pipeline** (`src/lib/generateSong.ts`) — the core of the app. `generateSongFile(input, revisionNotes?)`:
1. `MiniMax-Text-01` via `/v1/text/chatcompletion_v2` writes personalized lyrics, instructed to return strict JSON `{title, lyrics}`.
2. `music-2.6` via `/v1/music_generation` composes the song, returning **hex-encoded** mp3 (decoded to a Buffer).
3. Audio is uploaded to Supabase Storage bucket `songs` (must be **public** for playback); returns the public URL + `{title, lyrics}`.

Prompts are built in `src/lib/musicPrompts.ts`: `buildStylePrompt(style, tone, voiceGender)` → MiniMax music prompt; `buildLyricsMessages(brief, language, revisionNotes?)` → bilingual chat messages targeting a full ~2–3 min song, with revision support. Consumed by `/api/generate-song` (preview) and `/api/orders/[id]` PUT (live revision). **Both routes set `runtime='nodejs'` and `maxDuration=300`** — this requires a Vercel **Pro** plan; on Hobby (60s cap) a `maxDuration` of 300 fails the build.

**Data layer** (`src/lib/db.ts`) — Supabase Postgres, tables `orders`, `revisions`, `music_styles`. Columns are snake_case; `mapOrder`/`mapStyle`/`mapRevision` attach camelCase aliases so callers can read either (`audio_url` **or** `audioUrl`). All functions are async.

**Supabase clients** (`src/lib/supabase.ts`) — `getSupabaseBrowser()` (anon key, RLS applies, for client components) and `getSupabaseServer()` (service_role, bypasses RLS, for API routes). Both are created lazily inside functions, so importing them does not require env vars at build time.

**Auth** (`src/context/AuthContext.tsx`, `useAuth`) — Supabase Auth. Because no SMTP is configured, sign-up does NOT use client `auth.signUp`; it POSTs to `/api/auth/signup`, which uses `admin.createUser({ email_confirm: true })` to create an already-confirmed account (handling the "already exists" case by confirming + resetting via `admin.listUsers`/`updateUserById`), then the client does `signInWithPassword`. `signIn` self-heals: on an "Email not confirmed" error it calls that route and retries once.

**i18n** (`src/context/LanguageContext.tsx`, `useLanguage`) — `t('a.b.c', { name })` looks up nested keys in `src/locales/es.json` / `en.json` and does `{placeholder}` replacement. Default language is `es` (persisted in `localStorage['ct-lang']`). **Every user-facing string must exist in BOTH locale files with identical key paths** — a missing key makes `t()` return the raw key string. Some components branch on language by comparing a translated value, e.g. `t('nav.login') === 'Log in'` or `t('hero.stats') === 'songs created'`; keep those exact strings intact.

**Styling** — one global stylesheet `src/app/globals.css` with CSS custom properties in `:root` (light + blue theme, `--accent-primary: #2563EB`). No Tailwind / CSS modules; components use shared utility-ish classes (`.container`, `.card`, `.btn`, `.heading-lg`, spacing vars like `var(--space-lg)`) plus inline styles. When laying out grid/flex, add `min-width: 0` / `minmax(0, 1fr)` to children to avoid mobile horizontal "blowout".

**Constants** (`src/lib/constants.ts`) — `OCCASIONS`, `MUSIC_STYLES` (id/icon/color/`nameKey`), `OCCASION_STYLE_MAP`, `TIERS` (`basica`/`especial`/`premium` price + delivery).

## User flow & order lifecycle

Home wizard (`/`, scrolls to `#studio`; also `/create`) collects a brief → generates a **real** preview via `/api/generate-song` → pick a plan → `/signin` (auth) → `/checkout` (mock payment: POST `/api/orders` then `/api/checkout`) → redirect to `/dashboard?paid=1`. Orders are linked to the user by `client_email`; the dashboard loads them via `/api/orders?email=`. Revisions regenerate instantly through `/order/[id]/review` → PUT `/api/orders/[id]`.

Order status: `PENDING_PAYMENT` → (payment) `READY` (the song was already generated at preview, so it's available immediately). Other statuses: `IN_PRODUCTION`, `REVISION_REQUESTED`, `DELIVERED`.

The in-progress brief is passed between steps in `sessionStorage['ct-order']`.

## Vercel deployment gotchas (all have caused production 404s)

- **Framework Preset must be `Next.js`** (not `Other`) — with `Other`, builds go green but the site 404s because Next routing/functions aren't set up.
- **Root Directory** must be empty / `./` (the app is at the repo root, not in a subfolder on GitHub).
- All 5 env vars set; `NEXT_PUBLIC_*` must be present **before** the build.
- **Pro plan** required for `maxDuration = 300`.
- After changing any of the above, **redeploy** (env/preset changes only apply to a new build).

## Batch asset generation

`scripts/generate-gallery-songs.ps1` (PowerShell, reads `scripts/gallery-songs.json`) batch-generates the 12 gallery samples into `public/audio/g1..g12.mp3` via MiniMax `music-2.6`.
