-- ============================================================
-- CantaMe — Supabase setup (run once in the SQL Editor)
-- Fixes: "new row violates row-level security policy" on audio upload.
--
-- ✅ RECOMMENDED: instead of the policies below, just set
--    SUPABASE_SERVICE_ROLE_KEY in your env (.env.local + Vercel).
--    The service_role key bypasses RLS entirely, so section 1 alone
--    (public bucket) is enough. Sections 2 & 3 are only needed if you
--    keep using the anon key (less secure — anyone can read/write).
-- ============================================================

-- 1) Storage bucket "songs": create it + make it PUBLIC so the
--    generated song URLs are playable in the browser. (Always needed.)
insert into storage.buckets (id, name, public)
values ('songs', 'songs', true)
on conflict (id) do update set public = true;


-- ── Everything below is ONLY needed if you do NOT set the service_role key ──

-- 2) Storage policies: allow read/insert/update on the "songs" bucket.
drop policy if exists "songs_read"   on storage.objects;
create policy "songs_read"   on storage.objects for select using (bucket_id = 'songs');

drop policy if exists "songs_insert" on storage.objects;
create policy "songs_insert" on storage.objects for insert with check (bucket_id = 'songs');

drop policy if exists "songs_update" on storage.objects;
create policy "songs_update" on storage.objects for update using (bucket_id = 'songs');

-- 3) App tables: allow the app to read/write orders, revisions, styles.
alter table if exists public.orders       enable row level security;
alter table if exists public.revisions    enable row level security;
alter table if exists public.music_styles enable row level security;

drop policy if exists "orders_all" on public.orders;
create policy "orders_all" on public.orders for all using (true) with check (true);

drop policy if exists "revisions_all" on public.revisions;
create policy "revisions_all" on public.revisions for all using (true) with check (true);

drop policy if exists "styles_all" on public.music_styles;
create policy "styles_all" on public.music_styles for all using (true) with check (true);
