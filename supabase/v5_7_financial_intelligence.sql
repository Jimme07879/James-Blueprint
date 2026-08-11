-- Blueprint OS 5.7 — Financial Intelligence
create table if not exists public.financial_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null, source text, row_count integer default 0,
  total_sales numeric default 0, total_gp numeric default 0, total_due numeric default 0,
  imported_at timestamptz default now()
);
create table if not exists public.financial_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id uuid references public.financial_imports(id) on delete cascade,
  row_date date, customer text, sales numeric default 0, cost numeric default 0,
  gross_profit numeric default 0, amount_due numeric default 0, due_date date,
  reference text, source text, created_at timestamptz default now()
);
create index if not exists financial_rows_user_date_idx on public.financial_rows(user_id,row_date desc);
create index if not exists financial_rows_user_customer_idx on public.financial_rows(user_id,customer);
create index if not exists financial_rows_import_idx on public.financial_rows(import_id);
alter table public.financial_imports enable row level security;
alter table public.financial_rows enable row level security;
drop policy if exists "financial imports own rows" on public.financial_imports;
create policy "financial imports own rows" on public.financial_imports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "financial rows own rows" on public.financial_rows;
create policy "financial rows own rows" on public.financial_rows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
