-- loop. update: per-card state for the reels feed. Run this once in the Supabase SQL editor.
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
