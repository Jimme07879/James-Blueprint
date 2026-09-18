-- Blueprint OS 6.9 — Sage individual cost drill-down
-- Stores read-only AUDIT_SPLIT rows so category totals can be traced to their source entries.

create table if not exists public.sage_cost_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  cost_key text not null,
  transaction_date date not null,
  transaction_number text,
  split_number text,
  type text,
  nominal_code text not null,
  nominal_name text,
  reference text,
  details text,
  net_amount numeric not null default 0,
  normalized_cost numeric not null default 0,
  category text not null,
  included_in_management boolean not null default true,
  exclusion_reason text,
  synced_at timestamptz not null default now(),
  primary key (user_id,cost_key)
);

create index if not exists sage_cost_transactions_user_date_idx
  on public.sage_cost_transactions(user_id,transaction_date desc);
create index if not exists sage_cost_transactions_user_category_idx
  on public.sage_cost_transactions(user_id,category,transaction_date desc);
create index if not exists sage_cost_transactions_user_nominal_idx
  on public.sage_cost_transactions(user_id,nominal_code,transaction_date desc);

alter table public.sage_cost_transactions enable row level security;

drop policy if exists "sage cost transactions own rows" on public.sage_cost_transactions;
create policy "sage cost transactions own rows"
on public.sage_cost_transactions for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on public.sage_cost_transactions to authenticated;
revoke all on public.sage_cost_transactions from anon;

create or replace function public.sage_bridge_ingest_costs(p_bridge_key text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_user uuid;
  v_cost jsonb;
  v_count integer:=0;
  v_has_active_keys boolean:=false;
  v_active_keys text[];
begin
  select user_id into v_user
  from public.sage_bridge_connections
  where enabled=true
    and bridge_key_hash=encode(digest(p_bridge_key,'sha256'),'hex')
  limit 1;

  if v_user is null then raise exception 'Invalid Sage bridge key'; end if;

  v_has_active_keys := p_payload ? 'active_cost_keys';
  if v_has_active_keys then
    select coalesce(array_agg(value),array[]::text[])
    into v_active_keys
    from jsonb_array_elements_text(coalesce(p_payload->'active_cost_keys','[]'::jsonb));
  end if;

  for v_cost in
    select * from jsonb_array_elements(coalesce(p_payload->'costs','[]'::jsonb))
  loop
    if nullif(v_cost->>'cost_key','') is not null
       and nullif(v_cost->>'transaction_date','') is not null
       and nullif(v_cost->>'nominal_code','') is not null then
      insert into public.sage_cost_transactions(
        user_id,cost_key,transaction_date,transaction_number,split_number,type,
        nominal_code,nominal_name,reference,details,net_amount,normalized_cost,
        category,included_in_management,exclusion_reason,synced_at
      ) values (
        v_user,v_cost->>'cost_key',(v_cost->>'transaction_date')::date,
        v_cost->>'transaction_number',v_cost->>'split_number',v_cost->>'type',
        v_cost->>'nominal_code',v_cost->>'nominal_name',v_cost->>'reference',v_cost->>'details',
        coalesce(nullif(v_cost->>'net_amount','')::numeric,0),
        coalesce(nullif(v_cost->>'normalized_cost','')::numeric,0),
        coalesce(nullif(v_cost->>'category',''),'Admin / tech'),
        coalesce(nullif(v_cost->>'included_in_management','')::boolean,true),
        v_cost->>'exclusion_reason',now()
      )
      on conflict(user_id,cost_key) do update set
        transaction_date=excluded.transaction_date,
        transaction_number=excluded.transaction_number,
        split_number=excluded.split_number,
        type=excluded.type,
        nominal_code=excluded.nominal_code,
        nominal_name=excluded.nominal_name,
        reference=excluded.reference,
        details=excluded.details,
        net_amount=excluded.net_amount,
        normalized_cost=excluded.normalized_cost,
        category=excluded.category,
        included_in_management=excluded.included_in_management,
        exclusion_reason=excluded.exclusion_reason,
        synced_at=now();
      v_count:=v_count+1;
    end if;
  end loop;

  if v_has_active_keys then
    if array_length(v_active_keys,1) is null then
      delete from public.sage_cost_transactions where user_id=v_user;
    else
      delete from public.sage_cost_transactions
      where user_id=v_user and not(cost_key=any(v_active_keys));
    end if;
  end if;

  return jsonb_build_object('ok',true,'cost_transactions',v_count,'cleanup_applied',v_has_active_keys);
end $$;

revoke all on function public.sage_bridge_ingest_costs(text,jsonb) from public;
grant execute on function public.sage_bridge_ingest_costs(text,jsonb) to anon;
