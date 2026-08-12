-- Blueprint OS 6.1 — Sage Live Bridge
create extension if not exists pgcrypto;

create table if not exists public.sage_bridge_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bridge_name text,
  bridge_key_hash text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.sage_bridge_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bridge_name text,
  last_seen timestamptz,
  last_sync_status text,
  last_sync_message text,
  last_customer_count integer default 0,
  bridge_version text,
  updated_at timestamptz not null default now()
);
create table if not exists public.sage_customers (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_ref text not null,
  name text,
  balance numeric default 0,
  credit_limit numeric default 0,
  email text,
  telephone text,
  raw jsonb,
  synced_at timestamptz not null default now(),
  primary key(user_id,account_ref)
);

alter table public.sage_bridge_connections enable row level security;
alter table public.sage_bridge_status enable row level security;
alter table public.sage_customers enable row level security;

drop policy if exists "sage bridge connection own row" on public.sage_bridge_connections;
create policy "sage bridge connection own row" on public.sage_bridge_connections for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists "sage bridge status own row" on public.sage_bridge_status;
create policy "sage bridge status own row" on public.sage_bridge_status for select using(auth.uid()=user_id);

drop policy if exists "sage customers own rows" on public.sage_customers;
create policy "sage customers own rows" on public.sage_customers for select using(auth.uid()=user_id);

create or replace function public.sage_bridge_ingest(p_bridge_key text,p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path=public,extensions
as $$
declare
  v_user uuid;
  v_customer jsonb;
  v_count integer:=0;
begin
  select user_id into v_user
  from public.sage_bridge_connections
  where enabled=true and bridge_key_hash=encode(digest(p_bridge_key,'sha256'),'hex')
  limit 1;
  if v_user is null then raise exception 'Invalid Sage bridge key'; end if;

  if coalesce(p_payload->>'kind','')='customers' then
    for v_customer in select * from jsonb_array_elements(coalesce(p_payload->'customers','[]'::jsonb))
    loop
      if nullif(v_customer->>'account_ref','') is not null then
        insert into public.sage_customers(user_id,account_ref,name,balance,credit_limit,email,telephone,raw,synced_at)
        values(v_user,v_customer->>'account_ref',v_customer->>'name',coalesce((v_customer->>'balance')::numeric,0),coalesce((v_customer->>'credit_limit')::numeric,0),v_customer->>'email',v_customer->>'telephone',v_customer,now())
        on conflict(user_id,account_ref) do update set
          name=excluded.name,balance=excluded.balance,credit_limit=excluded.credit_limit,
          email=excluded.email,telephone=excluded.telephone,raw=excluded.raw,synced_at=now();
        v_count:=v_count+1;
      end if;
    end loop;
  end if;

  insert into public.sage_bridge_status(user_id,bridge_name,last_seen,last_sync_status,last_sync_message,last_customer_count,bridge_version,updated_at)
  values(v_user,coalesce(p_payload->>'bridge_name','Office Sage 50'),now(),'ok',coalesce(p_payload->>'message','Sage sync completed'),v_count,p_payload->>'bridge_version',now())
  on conflict(user_id) do update set
    bridge_name=excluded.bridge_name,last_seen=now(),last_sync_status='ok',
    last_sync_message=excluded.last_sync_message,last_customer_count=excluded.last_customer_count,
    bridge_version=excluded.bridge_version,updated_at=now();

  return jsonb_build_object('ok',true,'customers',v_count);
end $$;

revoke all on function public.sage_bridge_ingest(text,jsonb) from public;
grant execute on function public.sage_bridge_ingest(text,jsonb) to anon,authenticated;
