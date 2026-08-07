-- Blueprint OS 4.0 North Star
-- Run this once in Supabase SQL Editor before opening Proof or Vault.

create table if not exists public.proof_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  proof_date date not null default current_date,
  category text default 'Achievement',
  story text,
  created_at timestamptz default now()
);

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  title text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.proof_items enable row level security;
alter table public.vault_items enable row level security;

drop policy if exists "proof own rows" on public.proof_items;
create policy "proof own rows" on public.proof_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vault own rows" on public.vault_items;
create policy "vault own rows" on public.vault_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
