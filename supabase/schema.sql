-- loop. database. Run this once in the Supabase SQL editor (Database → SQL Editor → New query).
-- Every table has Row Level Security on, and every policy is scoped to auth.uid(),
-- so a student can only ever read or change their own rows.

-- Feeds a student generated from their own slides or notes.
create table if not exists public.feeds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  source      text not null default '',
  cards       jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists feeds_user_created on public.feeds (user_id, created_at desc);

-- One row per finished feed: score and which concepts were missed (the "swipe to reinforce" list).
-- feed_key is the feed's uuid for generated feeds, 'edtech-business-model' for the demo, 'video-<id>' for clipped videos.
create table if not exists public.attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_key    text not null check (char_length(feed_key) between 1 and 100),
  feed_title  text not null default '',
  correct     int  not null check (correct >= 0),
  total       int  not null check (total >= 0),
  missed      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists attempts_user_created on public.attempts (user_id, created_at desc);

-- Active-recall notes typed during a clipped video.
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_key    text not null check (char_length(feed_key) between 1 and 100),
  start_sec   int  not null default 0,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  unique (user_id, feed_key, start_sec)
);

alter table public.feeds    enable row level security;
alter table public.attempts enable row level security;
alter table public.notes    enable row level security;

-- feeds
drop policy if exists "feeds: read own"   on public.feeds;
drop policy if exists "feeds: insert own" on public.feeds;
drop policy if exists "feeds: update own" on public.feeds;
drop policy if exists "feeds: delete own" on public.feeds;
create policy "feeds: read own"   on public.feeds for select to authenticated using (user_id = auth.uid());
create policy "feeds: insert own" on public.feeds for insert to authenticated with check (user_id = auth.uid());
create policy "feeds: update own" on public.feeds for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "feeds: delete own" on public.feeds for delete to authenticated using (user_id = auth.uid());

-- attempts
drop policy if exists "attempts: read own"   on public.attempts;
drop policy if exists "attempts: insert own" on public.attempts;
drop policy if exists "attempts: delete own" on public.attempts;
create policy "attempts: read own"   on public.attempts for select to authenticated using (user_id = auth.uid());
create policy "attempts: insert own" on public.attempts for insert to authenticated with check (user_id = auth.uid());
create policy "attempts: delete own" on public.attempts for delete to authenticated using (user_id = auth.uid());

-- notes
drop policy if exists "notes: read own"   on public.notes;
drop policy if exists "notes: insert own" on public.notes;
drop policy if exists "notes: update own" on public.notes;
drop policy if exists "notes: delete own" on public.notes;
create policy "notes: read own"   on public.notes for select to authenticated using (user_id = auth.uid());
create policy "notes: insert own" on public.notes for insert to authenticated with check (user_id = auth.uid());
create policy "notes: update own" on public.notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes: delete own" on public.notes for delete to authenticated using (user_id = auth.uid());

-- saved      = the student tapped ❤️ (or double-tapped) to keep this card in their review rotation
-- missed     = they got this concept's quick check wrong last time (cleared when they get it right)
-- explanation = cached "explain it differently" answer from Claude, so it's only generated once
create table if not exists public.card_state (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feed_key     text not null check (char_length(feed_key) between 1 and 100),
  card_id      text not null check (char_length(card_id) between 1 and 60),
  saved        boolean not null default false,
  missed       boolean not null default false,
  explanation  jsonb,
  explained_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, feed_key, card_id)
);

alter table public.card_state enable row level security;

drop policy if exists "card_state: read own"   on public.card_state;
drop policy if exists "card_state: insert own" on public.card_state;
drop policy if exists "card_state: update own" on public.card_state;
drop policy if exists "card_state: delete own" on public.card_state;
create policy "card_state: read own"   on public.card_state for select to authenticated using (user_id = auth.uid());
create policy "card_state: insert own" on public.card_state for insert to authenticated with check (user_id = auth.uid());
create policy "card_state: update own" on public.card_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "card_state: delete own" on public.card_state for delete to authenticated using (user_id = auth.uid());
