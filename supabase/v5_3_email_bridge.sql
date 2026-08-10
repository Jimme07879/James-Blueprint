-- Blueprint OS 5.3 — Steve Email Bridge
-- Stores Outlook message metadata so Steve can remember handled state.
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  subject text,
  sender_name text,
  sender_address text,
  received_at timestamptz not null default now(),
  is_read boolean not null default false,
  importance text not null default 'normal',
  has_attachments boolean not null default false,
  body_preview text,
  web_link text,
  handled boolean not null default false,
  source text not null default 'outlook',
  created_at timestamptz not null default now(),
  unique(user_id, external_id)
);

alter table public.email_messages enable row level security;

drop policy if exists "Users can read own email messages" on public.email_messages;
create policy "Users can read own email messages" on public.email_messages for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own email messages" on public.email_messages;
create policy "Users can insert own email messages" on public.email_messages for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own email messages" on public.email_messages;
create policy "Users can update own email messages" on public.email_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
