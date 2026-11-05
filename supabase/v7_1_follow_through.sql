-- Blueprint: Follow-through commitments, owned by the signed-in user.
create table if not exists public.follow_through_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null check (area in ('Relationship','Personal','Business','Other')),
  title text not null check (length(trim(title)) > 0),
  next_action text not null check (length(trim(next_action)) > 0),
  review_date date not null,
  status text not null default 'open' check (status in ('open','waiting','done')),
  step_count integer not null default 0 check (step_count >= 0),
  last_progress_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists follow_through_commitments_owner_review
  on public.follow_through_commitments (user_id, status, review_date);
alter table public.follow_through_commitments enable row level security;
revoke all on public.follow_through_commitments from anon, authenticated;
grant select, insert, update, delete on public.follow_through_commitments to authenticated;
drop policy if exists "follow_through_select_own" on public.follow_through_commitments;
create policy "follow_through_select_own" on public.follow_through_commitments for select
  to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "follow_through_insert_own" on public.follow_through_commitments;
create policy "follow_through_insert_own" on public.follow_through_commitments for insert
  to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "follow_through_update_own" on public.follow_through_commitments;
create policy "follow_through_update_own" on public.follow_through_commitments for update
  to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "follow_through_delete_own" on public.follow_through_commitments;
create policy "follow_through_delete_own" on public.follow_through_commitments for delete
  to authenticated using ((select auth.uid()) = user_id);
