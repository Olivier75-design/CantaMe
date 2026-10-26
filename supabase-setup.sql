-- ============================================================
-- CantaMe — Supabase setup (run once in the SQL Editor)
-- Fixes: "new row violates row-level security policy" on audio upload.
--
-- ✅ REQUIRED: set SUPABASE_SERVICE_ROLE_KEY in your env (.env.local +
--    Vercel). The server uses it and it bypasses RLS, so the app needs
--    NO policy at all. Sections 2 & 3 REMOVE the permissive policies an
--    older version of this file created (they let anyone list every song
--    and read every order with the public anon key).
-- ============================================================

-- 1) Storage bucket "songs": create it + make it PUBLIC so the
--    generated song URLs are playable in the browser. (Always needed.)
insert into storage.buckets (id, name, public)
values ('songs', 'songs', true)
on conflict (id) do update set public = true;


-- 1b) Store the generated lyrics so the dashboard "LETRA" panel can show them.
--     Safe to run repeatedly. (The app degrades gracefully if this is missing.)
alter table if exists public.orders add column if not exists lyrics text;


-- 1c) Moneroo payments: tracks credit-pack purchases so crediting is reliable
--     and idempotent (webhook + return callback both settle the same row).
create table if not exists public.payments (
  id text primary key,          -- Moneroo payment id
  user_id uuid,
  credits int not null default 0,
  status text not null default 'pending',   -- pending | completed
  created_at timestamptz default now()
);

-- Promo / influencer tracking (safe to run repeatedly). Lets you tally how much
-- revenue each influencer code drove for commissions.
alter table public.payments add column if not exists amount numeric;      -- charged price after discount
alter table public.payments add column if not exists promo_code text;     -- e.g. CANTA40 (null = none)
alter table public.payments add column if not exists influencer text;     -- tracking label for the code


-- 1d) Traffic: server-side page-view counter (populated by middleware.ts).
--     Ad-blocker-proof analytics — visible in the Admin → Traffic tab.
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text,
  referrer text,
  country text,
  device text,
  created_at timestamptz default now()
);
create index if not exists page_views_created_at_idx on public.page_views (created_at desc);


-- 1e) Contact form messages (footer "Contact us" modal → Admin → Messages tab).
--     Replaces the old hello@cantame.app mailto link.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null default 'general',   -- general | order | payment | other
  message text not null,
  status text not null default 'new',        -- new | read | replied | archived
  admin_note text,
  user_id uuid,                              -- set when the sender was signed in
  ip text,
  user_agent text,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages (status);

-- IMPORTANT: RLS on with NO policies = only the service_role key can touch this
-- table. Visitor names/emails must never be readable from the browser, so unlike
-- the app tables below this one deliberately gets no permissive policy.
alter table public.contact_messages enable row level security;


-- 1f) Song ratings: the thumbs up/down the customer gives the finished song.
--     The point is to stop tuning prompts blind — every row snapshots the
--     settings that produced the song (style/tone/voice/occasion), so quality
--     can be compared per style or per voice WITHOUT joining orders, and it
--     still works for wizard songs that never became an order.
create table if not exists public.song_ratings (
  id uuid primary key default gen_random_uuid(),
  rating text not null,              -- up | down
  order_id text,                     -- null when rated straight from the wizard
  audio_url text,
  style text,
  tone text,
  voice_gender text,
  occasion text,
  language text,
  user_id uuid,
  ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
-- One rating per song: re-rating updates the row instead of stacking duplicates
-- that would skew the averages.
create unique index if not exists song_ratings_audio_url_key on public.song_ratings (audio_url);
create index if not exists song_ratings_created_at_idx on public.song_ratings (created_at desc);
create index if not exists song_ratings_style_idx on public.song_ratings (style);

-- RLS on with no policies: service_role only, same reasoning as contact_messages.
alter table public.song_ratings enable row level security;


-- 1g) Paywall: a generated song is LOCKED until the customer spends credits on
--     it. Generation is free for any signed-in account; credits buy access.
--
--     Added with default TRUE so every song that already exists stays playable
--     for the customer who made it under the old model, then flipped to FALSE
--     so new songs start locked. Written this way on purpose: it is idempotent,
--     so re-running this file never re-locks or re-unlocks anything.
alter table public.orders add column if not exists unlocked boolean not null default true;
alter table public.orders alter column unlocked set default false;


-- 1h) Landing-page showcase: songs the ADMIN picked out of the ones customers
--     rated 👍. Featuring is deliberately a separate flag from the thumbs up —
--     a customer liking their song is not permission to publish it, so the
--     admin curates. Featured songs are the only audio served publicly; every
--     other song stays behind the paywall.
alter table public.song_ratings add column if not exists featured boolean not null default false;
create index if not exists song_ratings_featured_idx on public.song_ratings (featured) where featured;


-- ── Lock-down: the app needs NO policy (the server uses service_role) ──

-- 2) Storage: drop EVERY policy on the "songs" bucket, whatever its name.
--    A public bucket still serves /object/public/ URLs with no policy, so
--    playback keeps working. A select policy let anyone LIST all songs —
--    locked ones included, i.e. the whole catalogue without paying — and
--    an insert policy let anyone upload arbitrary files into the bucket.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%songs%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

-- 3) App tables: RLS on, permissive policies gone (anon key reads nothing).
alter table if exists public.orders       enable row level security;
alter table if exists public.revisions    enable row level security;
alter table if exists public.music_styles enable row level security;
alter table if exists public.payments     enable row level security;
alter table if exists public.page_views   enable row level security;

drop policy if exists "orders_all"    on public.orders;
drop policy if exists "revisions_all" on public.revisions;
drop policy if exists "styles_all"    on public.music_styles;
