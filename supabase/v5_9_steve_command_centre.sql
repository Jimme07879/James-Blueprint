-- Blueprint OS 5.9 — Steve Command Centre
create table if not exists public.steve_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  title text,
  source text,
  status text not null default 'open',
  snoozed_until date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, alert_key)
);
create index if not exists steve_alerts_user_status_idx on public.steve_alerts(user_id,status);
alter table public.steve_alerts enable row level security;
drop policy if exists "steve alerts own rows" on public.steve_alerts;
create policy "steve alerts own rows" on public.steve_alerts for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
