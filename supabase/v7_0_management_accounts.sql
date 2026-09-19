-- N&J Finance Blueprint 7.0 — management accounts and stock valuation

create table if not exists public.sage_stock_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  stock_code text not null,
  description text,
  quantity numeric not null default 0,
  average_cost numeric not null default 0,
  sales_price numeric not null default 0,
  raw jsonb,
  synced_at timestamptz not null default now(),
  primary key (user_id, stock_code)
);

create table if not exists public.finance_stock_counts (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  month_end date not null,
  stock_code text not null,
  counted_quantity numeric not null default 0 check (counted_quantity >= 0),
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  provision_percent numeric not null default 0 check (provision_percent between 0 and 100),
  condition text not null default 'good' check (condition in ('good','slow','damaged','obsolete')),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_end, stock_code)
);

create table if not exists public.finance_month_closes (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  month_end date not null,
  status text not null default 'draft' check (status in ('draft','reviewed','locked')),
  stock_adjustment numeric not null default 0,
  accruals_adjustment numeric not null default 0,
  prepayments_adjustment numeric not null default 0,
  payroll_adjustment numeric not null default 0,
  depreciation numeric not null default 0,
  other_pnl_adjustment numeric not null default 0,
  creditors numeric not null default 0,
  bank_balance numeric not null default 0,
  cash_balance numeric not null default 0,
  accruals_balance numeric not null default 0,
  prepayments_balance numeric not null default 0,
  loan_balance numeric not null default 0,
  hp_balance numeric not null default 0,
  corporation_tax_provision numeric not null default 0,
  vat_balance numeric not null default 0,
  other_assets numeric not null default 0,
  other_liabilities numeric not null default 0,
  budget_sales numeric not null default 0,
  budget_gross_profit numeric not null default 0,
  budget_running_costs numeric not null default 0,
  stock_counted boolean not null default false,
  bank_reconciled boolean not null default false,
  debtors_reviewed boolean not null default false,
  creditors_reviewed boolean not null default false,
  payroll_posted boolean not null default false,
  accruals_reviewed boolean not null default false,
  vat_reviewed boolean not null default false,
  loans_reconciled boolean not null default false,
  accountant_reviewed boolean not null default false,
  notes text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_end)
);

create index if not exists sage_stock_items_user_value_idx on public.sage_stock_items(user_id, quantity, average_cost);
create index if not exists finance_stock_counts_user_month_idx on public.finance_stock_counts(user_id, month_end);

alter table public.sage_stock_items enable row level security;
alter table public.finance_stock_counts enable row level security;
alter table public.finance_month_closes enable row level security;

drop policy if exists "sage stock own rows" on public.sage_stock_items;
create policy "sage stock own rows" on public.sage_stock_items for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "finance stock counts own rows" on public.finance_stock_counts;
create policy "finance stock counts own rows" on public.finance_stock_counts for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "finance month closes own rows" on public.finance_month_closes;
create policy "finance month closes own rows" on public.finance_month_closes for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select on public.sage_stock_items to authenticated;
grant select, insert, update, delete on public.finance_stock_counts to authenticated;
grant select, insert, update, delete on public.finance_month_closes to authenticated;
revoke all on public.sage_stock_items, public.finance_stock_counts, public.finance_month_closes from anon;

create or replace function public.sage_bridge_ingest_stock(p_bridge_key text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_item jsonb;
  v_count integer := 0;
  v_codes text[];
  v_has_codes boolean := false;
begin
  select user_id into v_user
  from public.sage_bridge_connections
  where enabled = true and bridge_key_hash = encode(digest(p_bridge_key, 'sha256'), 'hex')
  limit 1;
  if v_user is null then raise exception 'Invalid Sage bridge key'; end if;

  v_has_codes := p_payload ? 'active_stock_codes';
  if v_has_codes then
    select coalesce(array_agg(value), array[]::text[]) into v_codes
    from jsonb_array_elements_text(coalesce(p_payload->'active_stock_codes', '[]'::jsonb));
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    if nullif(v_item->>'stock_code', '') is not null then
      insert into public.sage_stock_items(user_id, stock_code, description, quantity, average_cost, sales_price, raw, synced_at)
      values (
        v_user, v_item->>'stock_code', v_item->>'description',
        coalesce(nullif(v_item->>'quantity', '')::numeric, 0),
        coalesce(nullif(v_item->>'average_cost', '')::numeric, 0),
        coalesce(nullif(v_item->>'sales_price', '')::numeric, 0), v_item, now()
      )
      on conflict(user_id, stock_code) do update set
        description = excluded.description, quantity = excluded.quantity,
        average_cost = excluded.average_cost, sales_price = excluded.sales_price,
        raw = excluded.raw, synced_at = now();
      v_count := v_count + 1;
    end if;
  end loop;

  if v_has_codes then
    if array_length(v_codes, 1) is null then
      delete from public.sage_stock_items where user_id = v_user;
    else
      delete from public.sage_stock_items where user_id = v_user and not(stock_code = any(v_codes));
    end if;
  end if;

  return jsonb_build_object('ok', true, 'stock_items', v_count, 'cleanup_applied', v_has_codes);
end $$;

revoke all on function public.sage_bridge_ingest_stock(text, jsonb) from public;
revoke all on function public.sage_bridge_ingest_stock(text, jsonb) from authenticated;
grant execute on function public.sage_bridge_ingest_stock(text, jsonb) to anon;
