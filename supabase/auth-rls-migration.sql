-- Phone/PIN app-session authorization for a deployment without Supabase Auth.
-- Apply after schema.sql and deploy send-push with service-role credentials.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.current_app_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  request_headers jsonb;
  session_token text;
  resolved_user_id uuid;
begin
  begin
    request_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    return null;
  end;

  session_token := request_headers ->> 'x-loci-session';
  if session_token is null or session_token !~ '^[0-9a-fA-F]{64}$' then
    return null;
  end if;

  select app_session.user_id
    into resolved_user_id
    from public.notification_app_sessions as app_session
   where app_session.token_hash = encode(extensions.digest(session_token, 'sha256'), 'hex')
     and app_session.expires_at > now()
   limit 1;

  return resolved_user_id;
end;
$$;

create or replace function public.current_app_user_phone()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_user.phone
    from public.users as app_user
   where app_user.id = public.current_app_user_id()
   limit 1;
$$;

create or replace function public.app_is_session_owner(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.checkin_sessions as session
     where session.id = target_session_id
       and (session.user_id = public.current_app_user_id() or session.user_phone = public.current_app_user_phone())
  );
$$;

create or replace function public.app_is_session_recipient(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.session_recipients as recipient
     where recipient.session_id = target_session_id
       and (recipient.recipient_phone = public.current_app_user_phone()
         or recipient.contact_phone = public.current_app_user_phone())
  );
$$;

create or replace function public.app_is_trusted_contact(target_phone text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.trusted_contacts as contact
     where contact.user_phone = public.current_app_user_phone()
       and contact.phone = target_phone
  );
$$;

create or replace function public.app_profile_is_trusted_contact(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.users as target
     where target.id = target_user_id
       and public.app_is_trusted_contact(target.phone)
  );
$$;

create or replace function public.app_profile_is_session_sender(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.checkin_sessions as session
      join public.session_recipients as recipient on recipient.session_id = session.id
     where session.user_id = target_user_id
       and (recipient.recipient_phone = public.current_app_user_phone()
         or recipient.contact_phone = public.current_app_user_phone())
  );
$$;

revoke all on function public.current_app_user_id() from public;
revoke all on function public.current_app_user_phone() from public;
revoke all on function public.app_is_session_owner(uuid) from public;
revoke all on function public.app_is_session_recipient(uuid) from public;
revoke all on function public.app_is_trusted_contact(text) from public;
revoke all on function public.app_profile_is_trusted_contact(uuid) from public;
revoke all on function public.app_profile_is_session_sender(uuid) from public;
grant execute on function public.current_app_user_id() to anon, authenticated, service_role;
grant execute on function public.current_app_user_phone() to anon, authenticated, service_role;
grant execute on function public.app_is_session_owner(uuid) to anon, authenticated, service_role;
grant execute on function public.app_is_session_recipient(uuid) to anon, authenticated, service_role;
grant execute on function public.app_is_trusted_contact(text) to anon, authenticated, service_role;
grant execute on function public.app_profile_is_trusted_contact(uuid) to anon, authenticated, service_role;
grant execute on function public.app_profile_is_session_sender(uuid) to anon, authenticated, service_role;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'users', 'trusted_contacts', 'checkin_sessions', 'session_recipients',
         'notifications', 'user_push_subscriptions', 'notification_app_sessions',
         'notification_pin_attempts'
       )
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

alter table public.users enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.checkin_sessions enable row level security;
alter table public.session_recipients enable row level security;
alter table public.notifications enable row level security;
alter table public.user_push_subscriptions enable row level security;
alter table public.notification_app_sessions enable row level security;
alter table public.notification_pin_attempts enable row level security;

revoke all on table public.users from public, anon, authenticated;
revoke all on table public.trusted_contacts from public, anon, authenticated;
revoke all on table public.checkin_sessions from public, anon, authenticated;
revoke all on table public.session_recipients from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.user_push_subscriptions from public, anon, authenticated;
revoke all on table public.notification_app_sessions from public, anon, authenticated;
revoke all on table public.notification_pin_attempts from public, anon, authenticated;

grant select (id, phone, full_name, nickname, email, avatar_url, created_at) on table public.users to anon, authenticated;
grant insert (phone, full_name, nickname, avatar_url, pin_hash) on table public.users to anon, authenticated;
grant update (full_name, nickname, email, avatar_url) on table public.users to anon, authenticated;
grant select, insert, update, delete on table public.trusted_contacts to anon, authenticated;
grant select, insert, update, delete on table public.checkin_sessions to anon, authenticated;
grant select, insert, update, delete on table public.session_recipients to anon, authenticated;
grant select, insert, update, delete on table public.notifications to anon, authenticated;
grant select, insert, update, delete on table public.user_push_subscriptions to anon, authenticated;

create policy users_select_self
  on public.users for select to anon, authenticated
  using (id = public.current_app_user_id());

create policy users_select_trusted_contacts
  on public.users for select to anon, authenticated
  using (public.app_profile_is_trusted_contact(id));

create policy users_select_shared_session_participants
  on public.users for select to anon, authenticated
  using (public.app_profile_is_session_sender(id));

create policy users_insert_signup
  on public.users for insert to anon, authenticated
  with check (
    phone ~ '^\+[1-9][0-9]{7,14}$'
    and coalesce(length(btrim(full_name)), 0) between 1 and 120
    and coalesce(length(btrim(nickname)), 0) between 1 and 60
    and pin_hash ~ '^pbkdf2\$[0-9]{6}\$[0-9a-fA-F]{32}\$[0-9a-fA-F]{64}$'
  );

create policy users_update_self
  on public.users for update to anon, authenticated
  using (id = public.current_app_user_id())
  with check (id = public.current_app_user_id());

create policy trusted_contacts_select_owner
  on public.trusted_contacts for select to anon, authenticated
  using (user_phone = public.current_app_user_phone());

create policy trusted_contacts_insert_owner
  on public.trusted_contacts for insert to anon, authenticated
  with check (user_phone = public.current_app_user_phone());

create policy trusted_contacts_update_owner
  on public.trusted_contacts for update to anon, authenticated
  using (user_phone = public.current_app_user_phone())
  with check (user_phone = public.current_app_user_phone());

create policy trusted_contacts_delete_owner
  on public.trusted_contacts for delete to anon, authenticated
  using (user_phone = public.current_app_user_phone());

create policy checkin_sessions_select_owner
  on public.checkin_sessions for select to anon, authenticated
  using (user_id = public.current_app_user_id() or user_phone = public.current_app_user_phone());

create policy checkin_sessions_select_recipient
  on public.checkin_sessions for select to anon, authenticated
  using (public.app_is_session_recipient(id));

create policy checkin_sessions_insert_owner
  on public.checkin_sessions for insert to anon, authenticated
  with check (
    user_id = public.current_app_user_id()
    and user_phone = public.current_app_user_phone()
  );

create policy checkin_sessions_update_owner
  on public.checkin_sessions for update to anon, authenticated
  using (user_id = public.current_app_user_id() or user_phone = public.current_app_user_phone())
  with check (
    user_id = public.current_app_user_id()
    and user_phone = public.current_app_user_phone()
  );

create policy checkin_sessions_delete_owner
  on public.checkin_sessions for delete to anon, authenticated
  using (user_id = public.current_app_user_id() or user_phone = public.current_app_user_phone());

create policy session_recipients_select_owner_or_recipient
  on public.session_recipients for select to anon, authenticated
  using (
    recipient_phone = public.current_app_user_phone()
    or contact_phone = public.current_app_user_phone()
    or public.app_is_session_owner(session_id)
  );

create policy session_recipients_insert_session_owner
  on public.session_recipients for insert to anon, authenticated
  with check (
    public.app_is_session_owner(session_id)
    and public.app_is_trusted_contact(contact_phone)
    and contact_phone = recipient_phone
  );

create policy session_recipients_update_session_owner
  on public.session_recipients for update to anon, authenticated
  using (public.app_is_session_owner(session_id))
  with check (public.app_is_session_owner(session_id));

create policy session_recipients_delete_session_owner
  on public.session_recipients for delete to anon, authenticated
  using (public.app_is_session_owner(session_id));

create policy notifications_select_owner
  on public.notifications for select to anon, authenticated
  using (user_id = public.current_app_user_id());

create policy notifications_insert_owner
  on public.notifications for insert to anon, authenticated
  with check (
    user_id = public.current_app_user_id()
    and (sender_id is null or sender_id = public.current_app_user_id())
  );

create policy notifications_update_owner
  on public.notifications for update to anon, authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

create policy notifications_delete_owner
  on public.notifications for delete to anon, authenticated
  using (user_id = public.current_app_user_id());

create policy user_push_subscriptions_select_owner
  on public.user_push_subscriptions for select to anon, authenticated
  using (user_id = public.current_app_user_id());

create policy user_push_subscriptions_insert_owner
  on public.user_push_subscriptions for insert to anon, authenticated
  with check (user_id = public.current_app_user_id());

create policy user_push_subscriptions_update_owner
  on public.user_push_subscriptions for update to anon, authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

create policy user_push_subscriptions_delete_owner
  on public.user_push_subscriptions for delete to anon, authenticated
  using (user_id = public.current_app_user_id());

-- These internal tables are accessed only by send-push with service_role.
revoke all on table public.notification_app_sessions from anon, authenticated;
revoke all on table public.notification_pin_attempts from anon, authenticated;

-- Helper function owner needs table access; client roles do not get it directly.
grant select on table public.notification_app_sessions to postgres, service_role;
