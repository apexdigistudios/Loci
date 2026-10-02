-- Loci database schema
-- Safe to run repeatedly in the Supabase SQL editor.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  full_name text,
  nickname text,
  email text,
  avatar_url text,
  pin_hash text,
  created_at timestamptz not null default now()
);

alter table public.users
  add column if not exists pin_hash text;

create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null references public.users(phone) on delete cascade,
  name text not null,
  phone text not null,
  group_category text not null default 'Emergency Circle',
  created_at timestamptz not null default now()
);

create table if not exists public.checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null references public.users(phone) on delete cascade,
  destination text not null,
  expected_arrival_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'missed', 'escalated')),
  notes text,
  media_url text,
  current_lat double precision,
  current_lng double precision,
  target_group text,
  created_at timestamptz not null default now()
);

create table if not exists public.session_recipients (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.checkin_sessions(id) on delete cascade,
  contact_phone text not null,
  recipient_phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null references public.users(phone) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null references public.users(phone) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Phone lookups, feed filters, recipient resolution, and session status queries.
create index if not exists trusted_contacts_user_phone_idx
  on public.trusted_contacts(user_phone);
create index if not exists trusted_contacts_phone_idx
  on public.trusted_contacts(phone);
create index if not exists checkin_sessions_user_phone_idx
  on public.checkin_sessions(user_phone);
create index if not exists checkin_sessions_status_idx
  on public.checkin_sessions(status);
create index if not exists checkin_sessions_created_at_idx
  on public.checkin_sessions(created_at desc);
create index if not exists session_recipients_session_id_idx
  on public.session_recipients(session_id);
create index if not exists session_recipients_contact_phone_idx
  on public.session_recipients(contact_phone);
create index if not exists session_recipients_recipient_phone_idx
  on public.session_recipients(recipient_phone);
create index if not exists user_push_subscriptions_user_phone_idx
  on public.user_push_subscriptions(user_phone);
create index if not exists user_push_subscriptions_user_phone_idx
  on public.user_push_subscriptions(user_phone);

-- The unique constraint on public.users(phone) creates its phone lookup index.

-- Public avatar reads and uploads are intentional for the current client-side app.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

alter table storage.objects enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_public_select'
  ) then
    create policy avatars_public_select
      on storage.objects for select
      to public
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_public_insert'
  ) then
    create policy avatars_public_insert
      on storage.objects for insert
      to public
      with check (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_public_update'
  ) then
    create policy avatars_public_update
      on storage.objects for update
      to public
      using (bucket_id = 'avatars')
      with check (bucket_id = 'avatars');
  end if;
end;
$$;

-- Add the required tables to Realtime only when missing from the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'checkin_sessions'
  ) then
    alter publication supabase_realtime add table public.checkin_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_recipients'
  ) then
    alter publication supabase_realtime add table public.session_recipients;
  end if;
end;
$$;