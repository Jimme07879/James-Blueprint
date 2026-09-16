-- Blueprint OS: Discipline end-of-day records

create table if not exists public.discipline_day_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null default current_date,
  proof_1_completed boolean not null default false,
  proof_2_completed boolean not null default false,
  proof_3_completed boolean not null default false,
  win text,
  fell_short text,
  lesson text,
  tomorrow_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discipline_day_records_user_date_key unique (user_id, record_date)
);

alter table public.discipline_day_records enable row level security;

grant select, insert, update, delete on public.discipline_day_records to authenticated;

drop policy if exists "discipline day records own rows" on public.discipline_day_records;
create policy "discipline day records own rows"
on public.discipline_day_records
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
