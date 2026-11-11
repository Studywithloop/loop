-- loop. update: counts AI voice-overs so each student has a daily limit. Run this once in the Supabase SQL editor.
create table if not exists public.voice_uses (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists voice_uses_user_created on public.voice_uses (user_id, created_at desc);

alter table public.voice_uses enable row level security;

drop policy if exists "voice_uses: read own"   on public.voice_uses;
drop policy if exists "voice_uses: insert own" on public.voice_uses;
create policy "voice_uses: read own"   on public.voice_uses for select to authenticated using (user_id = auth.uid());
create policy "voice_uses: insert own" on public.voice_uses for insert to authenticated with check (user_id = auth.uid());
