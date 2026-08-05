-- Run this entire file in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  sleep_hours numeric, sleep_quality int, energy int, mood int, stress int, focus int, confidence int,
  overall_score int, mission text, priority_1 text, priority_2 text, priority_3 text,
  pillar_scores jsonb default '{}'::jsonb, pillar_actions jsonb default '{}'::jsonb,
  opportunity text, risk text, avoiding text, delegate_task text, automate_task text,
  relationship_who text, relationship_action text, relationship_promise text, listened text,
  habits jsonb default '{}'::jsonb, learning_plan text, lesson text, wins text, improvement text,
  gratitude text, tomorrow_mission text, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null, wins text, lessons text, not_worked text, priority text, actions text,
  relationship_intention text, health_intention text, created_at timestamptz default now()
);

create table if not exists public.business_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null, sales_target numeric default 0, sales_actual numeric default 0,
  gross_profit numeric default 0, debtors numeric default 0, notes text, created_at timestamptz default now(),
  unique(user_id, snapshot_date)
);

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, contact text, stage text default 'Prospect', next_action text, created_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, next_action text, deadline date, status text default 'Not started', created_at timestamptz default now()
);

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mission_statement text, relationship_notes text, date_ideas text, updated_at timestamptz default now()
);

alter table public.daily_entries enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.business_snapshots enable row level security;
alter table public.sales_leads enable row level security;
alter table public.goals enable row level security;
alter table public.app_settings enable row level security;

create policy "daily own rows" on public.daily_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly own rows" on public.weekly_reviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "business own rows" on public.business_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "leads own rows" on public.sales_leads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals own rows" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings own row" on public.app_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
