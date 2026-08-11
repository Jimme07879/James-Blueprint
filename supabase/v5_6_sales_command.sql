-- Blueprint OS 5.6 - Sales Command Centre
-- Run once in Supabase SQL Editor before using the new Sales fields.

alter table public.sales_leads add column if not exists contact_name text;
alter table public.sales_leads add column if not exists email text;
alter table public.sales_leads add column if not exists phone text;
alter table public.sales_leads add column if not exists source text;
alter table public.sales_leads add column if not exists current_supplier text;
alter table public.sales_leads add column if not exists products_interested text;
alter table public.sales_leads add column if not exists quoted_value numeric default 0;
alter table public.sales_leads add column if not exists weekly_value numeric default 0;
alter table public.sales_leads add column if not exists follow_up_date date;
alter table public.sales_leads add column if not exists last_contacted date;
alter table public.sales_leads add column if not exists notes text;

create index if not exists sales_leads_follow_up_idx on public.sales_leads(user_id, follow_up_date);
