-- Blueprint OS 5.0 — Decision Journal
-- Run once in Supabase SQL Editor before using Decisions.

create table if not exists public.decision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  decision_date date not null,
  category text default 'Personal',
  context text,
  options_considered text,
  decision_made text not null,
  expected_outcome text,
  review_date date,
  review_status text default 'Open',
  actual_outcome text,
  lesson text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.decision_items enable row level security;

drop policy if exists "decision items own rows" on public.decision_items;
create policy "decision items own rows" on public.decision_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
