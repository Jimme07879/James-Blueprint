-- Blueprint OS 6.7 — Today's Cash & Customer Actions
create extension if not exists pgcrypto;
create table if not exists public.customer_cash_actions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_ref text not null, customer_name text,
  action_type text not null check (action_type in ('called','promised_payment','follow_up','resolved')),
  status text not null default 'open' check (status in ('open','promised','follow_up','resolved')),
  note text, promised_amount numeric(12,2) check (promised_amount is null or promised_amount >= 0), due_date date,
  completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists customer_cash_actions_user_due_idx on public.customer_cash_actions(user_id,status,due_date);
create index if not exists customer_cash_actions_user_account_idx on public.customer_cash_actions(user_id,account_ref,created_at desc);
alter table public.customer_cash_actions enable row level security;
drop policy if exists "cash actions own rows select" on public.customer_cash_actions;
create policy "cash actions own rows select" on public.customer_cash_actions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "cash actions own rows insert" on public.customer_cash_actions;
create policy "cash actions own rows insert" on public.customer_cash_actions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "cash actions own rows update" on public.customer_cash_actions;
create policy "cash actions own rows update" on public.customer_cash_actions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "cash actions own rows delete" on public.customer_cash_actions;
create policy "cash actions own rows delete" on public.customer_cash_actions for delete to authenticated using ((select auth.uid()) = user_id);
grant select,insert,update,delete on public.customer_cash_actions to authenticated;
