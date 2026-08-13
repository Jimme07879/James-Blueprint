-- Blueprint OS 6.2 — Sage Debtors + Customer Activity
create extension if not exists pgcrypto;

alter table public.sage_bridge_status add column if not exists last_transaction_count integer default 0;

create table if not exists public.sage_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  tran_number text not null,
  item_count integer,
  type text,
  transaction_date date,
  account_ref text,
  inv_ref text,
  details text,
  due_date date,
  net_amount numeric default 0,
  tax_amount numeric default 0,
  gross_amount numeric default 0,
  amount_paid numeric default 0,
  outstanding numeric default 0,
  paid_flag integer,
  paid_status text,
  raw jsonb,
  synced_at timestamptz not null default now(),
  primary key(user_id,tran_number)
);

create index if not exists sage_transactions_user_account_idx on public.sage_transactions(user_id,account_ref);
create index if not exists sage_transactions_user_date_idx on public.sage_transactions(user_id,transaction_date desc);
create index if not exists sage_transactions_user_due_idx on public.sage_transactions(user_id,due_date);

alter table public.sage_transactions enable row level security;
drop policy if exists "sage transactions own rows" on public.sage_transactions;
create policy "sage transactions own rows" on public.sage_transactions for select using(auth.uid()=user_id);

create or replace function public.sage_bridge_ingest(p_bridge_key text,p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path=public,extensions
as $$
declare
  v_user uuid;
  v_customer jsonb;
  v_transaction jsonb;
  v_count integer:=0;
  v_transaction_count integer:=0;
  v_refs text[];
  v_tx_refs text[];
  v_has_active_refs boolean:=false;
  v_has_tx_refs boolean:=false;
begin
  select user_id into v_user
  from public.sage_bridge_connections
  where enabled=true and bridge_key_hash=encode(digest(p_bridge_key,'sha256'),'hex')
  limit 1;
  if v_user is null then raise exception 'Invalid Sage bridge key'; end if;

  if coalesce(p_payload->>'kind','')='customers' then
    v_has_active_refs := p_payload ? 'active_account_refs';
    if v_has_active_refs then
      select coalesce(array_agg(value),array[]::text[]) into v_refs
      from jsonb_array_elements_text(coalesce(p_payload->'active_account_refs','[]'::jsonb));
    end if;

    for v_customer in select * from jsonb_array_elements(coalesce(p_payload->'customers','[]'::jsonb)) loop
      if nullif(v_customer->>'account_ref','') is not null then
        insert into public.sage_customers(user_id,account_ref,name,balance,credit_limit,email,telephone,raw,synced_at)
        values(v_user,v_customer->>'account_ref',v_customer->>'name',coalesce((v_customer->>'balance')::numeric,0),coalesce((v_customer->>'credit_limit')::numeric,0),v_customer->>'email',v_customer->>'telephone',v_customer,now())
        on conflict(user_id,account_ref) do update set
          name=excluded.name,balance=excluded.balance,credit_limit=excluded.credit_limit,email=excluded.email,telephone=excluded.telephone,raw=excluded.raw,synced_at=now();
        v_count:=v_count+1;
      end if;
    end loop;

    if v_has_active_refs and array_length(v_refs,1) is not null then
      delete from public.sage_customers where user_id=v_user and not(account_ref=any(v_refs));
    end if;
  end if;

  if coalesce(p_payload->>'kind','')='transactions' then
    v_has_tx_refs := p_payload ? 'active_transaction_refs';
    if v_has_tx_refs then
      select coalesce(array_agg(value),array[]::text[]) into v_tx_refs
      from jsonb_array_elements_text(coalesce(p_payload->'active_transaction_refs','[]'::jsonb));
    end if;

    for v_transaction in select * from jsonb_array_elements(coalesce(p_payload->'transactions','[]'::jsonb)) loop
      if nullif(v_transaction->>'tran_number','') is not null then
        insert into public.sage_transactions(user_id,tran_number,item_count,type,transaction_date,account_ref,inv_ref,details,due_date,net_amount,tax_amount,gross_amount,amount_paid,outstanding,paid_flag,paid_status,raw,synced_at)
        values(
          v_user,v_transaction->>'tran_number',nullif(v_transaction->>'item_count','')::integer,v_transaction->>'type',nullif(v_transaction->>'transaction_date','')::date,
          v_transaction->>'account_ref',v_transaction->>'inv_ref',v_transaction->>'details',nullif(v_transaction->>'due_date','')::date,
          coalesce(nullif(v_transaction->>'net_amount','')::numeric,0),coalesce(nullif(v_transaction->>'tax_amount','')::numeric,0),coalesce(nullif(v_transaction->>'gross_amount','')::numeric,0),
          coalesce(nullif(v_transaction->>'amount_paid','')::numeric,0),coalesce(nullif(v_transaction->>'outstanding','')::numeric,0),nullif(v_transaction->>'paid_flag','')::integer,v_transaction->>'paid_status',v_transaction,now()
        )
        on conflict(user_id,tran_number) do update set
          item_count=excluded.item_count,type=excluded.type,transaction_date=excluded.transaction_date,account_ref=excluded.account_ref,inv_ref=excluded.inv_ref,details=excluded.details,
          due_date=excluded.due_date,net_amount=excluded.net_amount,tax_amount=excluded.tax_amount,gross_amount=excluded.gross_amount,amount_paid=excluded.amount_paid,outstanding=excluded.outstanding,
          paid_flag=excluded.paid_flag,paid_status=excluded.paid_status,raw=excluded.raw,synced_at=now();
        v_transaction_count:=v_transaction_count+1;
      end if;
    end loop;

    if v_has_tx_refs then
      if array_length(v_tx_refs,1) is not null then
        delete from public.sage_transactions where user_id=v_user and not(tran_number=any(v_tx_refs));
      end if;
    end if;
  end if;

  insert into public.sage_bridge_status(user_id,bridge_name,last_seen,last_sync_status,last_sync_message,last_customer_count,last_transaction_count,bridge_version,updated_at)
  values(v_user,coalesce(p_payload->>'bridge_name','Office Sage 50'),now(),'ok',coalesce(p_payload->>'message','Sage sync completed'),v_count,v_transaction_count,p_payload->>'bridge_version',now())
  on conflict(user_id) do update set
    bridge_name=excluded.bridge_name,last_seen=now(),last_sync_status='ok',last_sync_message=excluded.last_sync_message,
    last_customer_count=case when v_count>0 then v_count else public.sage_bridge_status.last_customer_count end,
    last_transaction_count=case when v_transaction_count>0 then v_transaction_count else public.sage_bridge_status.last_transaction_count end,
    bridge_version=excluded.bridge_version,updated_at=now();

  return jsonb_build_object('ok',true,'customers',v_count,'transactions',v_transaction_count,'active_cleanup_applied',v_has_active_refs,'transaction_cleanup_applied',v_has_tx_refs);
end $$;

revoke all on function public.sage_bridge_ingest(text,jsonb) from public;
grant execute on function public.sage_bridge_ingest(text,jsonb) to anon,authenticated;
