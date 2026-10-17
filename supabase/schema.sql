-- Loci database schema
-- Safe to run repeatedly in the Supabase SQL editor.
-- After this base schema, apply auth-rls-migration.sql to enable phone/PIN app-session RLS.

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
  user_id uuid references public.users(id) on delete cascade,
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
  user_reminder_mins integer not null default 15,
  contact_reminder_mins integer not null default 30,
  last_user_checkin_at timestamptz not null default now(),
  last_user_reminder_sent_at timestamptz,
  session_started_push_sent_at timestamptz,
  session_completed_push_sent_at timestamptz,
  guardian_alert_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.checkin_sessions
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists user_reminder_mins integer not null default 15,
  add column if not exists contact_reminder_mins integer not null default 30,
  add column if not exists last_user_checkin_at timestamptz not null default now(),
  add column if not exists last_user_reminder_sent_at timestamptz,
  add column if not exists session_started_push_sent_at timestamptz,
  add column if not exists session_completed_push_sent_at timestamptz,
  add column if not exists guardian_alert_sent_at timestamptz;

update public.checkin_sessions as sessions
set user_id = users.id
from public.users
where sessions.user_id is null
  and sessions.user_phone = users.phone;

create table if not exists public.session_recipients (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.checkin_sessions(id) on delete cascade,
  contact_phone text not null,
  recipient_phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  title text not null,
  message text not null,
  type text not null default 'update',
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

drop index if exists public.notifications_user_phone_created_at_idx;

alter table public.notifications
  drop constraint if exists notifications_owner_required,
  drop column if exists user_phone,
  drop column if exists "read";

alter table public.notifications
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists sender_id uuid references public.users(id) on delete set null,
  add column if not exists title text not null default '',
  add column if not exists message text not null default '',
  add column if not exists type text not null default 'update',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_read boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.notifications
  alter column user_id set not null;

create index if not exists notifications_user_id_created_at_idx
  on public.notifications(user_id, created_at desc);

create table if not exists public.user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_info jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists public.user_push_subscriptions_user_phone_idx;

alter table public.user_push_subscriptions
  drop column if exists user_phone;

alter table public.user_push_subscriptions
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists device_info jsonb not null default '{}'::jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now(),
  alter column user_id set not null;

create table if not exists public.notification_app_sessions (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_pin_attempts (
  phone text primary key,
  attempt_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

create or replace function public.begin_notification_pin_attempt(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt_count integer;
  v_locked_until timestamptz;
begin
  insert into public.notification_pin_attempts (phone, attempt_count, window_started_at)
  values (p_phone, 1, now())
  on conflict (phone) do update
  set attempt_count = case
        when public.notification_pin_attempts.window_started_at < now() - interval '15 minutes' then 1
        else public.notification_pin_attempts.attempt_count + 1
      end,
      window_started_at = case
        when public.notification_pin_attempts.window_started_at < now() - interval '15 minutes' then now()
        else public.notification_pin_attempts.window_started_at
      end,
      locked_until = case
        when public.notification_pin_attempts.locked_until > now() then public.notification_pin_attempts.locked_until
        when public.notification_pin_attempts.window_started_at < now() - interval '15 minutes' then null
        when public.notification_pin_attempts.attempt_count + 1 >= 6 then now() + interval '15 minutes'
        else null
      end
  returning attempt_count, locked_until into v_attempt_count, v_locked_until;

  return v_attempt_count <= 5 and (v_locked_until is null or v_locked_until <= now());
end;
$$;

create or replace function public.reset_notification_pin_attempt(p_phone text)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  delete from public.notification_pin_attempts where phone = p_phone;
$$;

revoke all on function public.begin_notification_pin_attempt(text) from public, anon, authenticated;
revoke all on function public.reset_notification_pin_attempt(text) from public, anon, authenticated;
grant execute on function public.begin_notification_pin_attempt(text) to service_role;
grant execute on function public.reset_notification_pin_attempt(text) to service_role;

alter table public.notifications enable row level security;
alter table public.user_push_subscriptions enable row level security;
alter table public.notification_app_sessions enable row level security;
alter table public.notification_pin_attempts enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('notifications', 'user_push_subscriptions', 'notification_app_sessions', 'notification_pin_attempts')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

-- Phone lookups, feed filters, recipient resolution, and session status queries.
create index if not exists trusted_contacts_user_phone_idx
  on public.trusted_contacts(user_phone);
create index if not exists trusted_contacts_phone_idx
  on public.trusted_contacts(phone);
create index if not exists checkin_sessions_user_phone_idx
  on public.checkin_sessions(user_phone);
create index if not exists checkin_sessions_user_id_idx
  on public.checkin_sessions(user_id);
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
create index if not exists user_push_subscriptions_user_id_idx
  on public.user_push_subscriptions(user_id);
create index if not exists notification_app_sessions_user_expires_idx
  on public.notification_app_sessions(user_id, expires_at);

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