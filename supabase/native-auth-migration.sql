-- Replace phone/PIN app sessions with Supabase Auth identity.
-- Apply after schema.sql and before deploying the native-auth application.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.referrals (
  referrer_phone text not null references public.users(phone) on delete cascade,
  referred_phone text not null unique references public.users(phone) on delete cascade,
  created_at timestamptz not null default now()
);

-- Keep existing child records attached when a phone-based profile adopts its Auth UUID.
do $$
declare
  foreign_key record;
  definition text;
begin
  for foreign_key in
    select constraint_row.oid, constraint_row.conname, constraint_row.conrelid
      from pg_constraint as constraint_row
     where constraint_row.contype = 'f'
       and constraint_row.confrelid = 'public.users'::regclass
  loop
    definition := pg_get_constraintdef(foreign_key.oid);
    if position('ON UPDATE' in upper(definition)) = 0 then
      if position('ON DELETE' in upper(definition)) > 0 then
        definition := regexp_replace(definition, ' ON DELETE', ' ON UPDATE CASCADE ON DELETE', 'i');
      else
        definition := definition || ' ON UPDATE CASCADE';
      end if;
      execute format('alter table %s drop constraint %I', foreign_key.conrelid::regclass, foreign_key.conname);
      execute format('alter table %s add constraint %I %s', foreign_key.conrelid::regclass, foreign_key.conname, definition);
    end if;
  end loop;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  clean_digits text;
  clean_phone text;
  profile_name text;
  profile_nickname text;
  referrer_code text;
  normalized_referrer_phone text;
begin
  clean_digits := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g');
  if length(clean_digits) < 8 or length(clean_digits) > 15 then
    raise exception 'A valid phone number is required in account metadata';
  end if;

  clean_phone := '+' || clean_digits;
  profile_name := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '');
  profile_nickname := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), 60), '');
  if profile_name is null or profile_nickname is null then
    raise exception 'Full name and nickname are required in account metadata';
  end if;

  insert into public.users (id, phone, full_name, nickname, email)
  values (new.id, clean_phone, profile_name, profile_nickname, new.email)
  on conflict (phone) do update
    set full_name = excluded.full_name,
        nickname = excluded.nickname,
        email = excluded.email
    where public.users.id = excluded.id;

  if not exists (
    select 1 from public.users as app_user where app_user.id = new.id and app_user.phone = clean_phone
  ) then
    raise exception 'This phone number is already linked to another account';
  end if;

  referrer_code := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'referrer_code', '')), 120), '');
  if referrer_code is not null then
    normalized_referrer_phone := '+' || regexp_replace(referrer_code, '\D', '', 'g');

    insert into public.referrals (referrer_phone, referred_phone)
    select referrer.phone, clean_phone
      from public.users as referrer
     where referrer.id <> new.id
       and (
         referrer.id = case
           when referrer_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then referrer_code::uuid
           else null
         end
         or referrer.phone = normalized_referrer_phone
         or lower(referrer.nickname) = lower(referrer_code)
       )
       and not exists (
         select 1 from public.referrals as existing_referral
          where existing_referral.referrer_phone = referrer.phone
            and existing_referral.referred_phone = clean_phone
       )
     order by case
       when referrer.id = case
         when referrer_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           then referrer_code::uuid
         else null
       end then 0
       when referrer.phone = normalized_referrer_phone then 1
       else 2
     end
     limit 1
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Reconcile already-created proxy-email Auth users, if this migration is applied after rollout.
insert into public.users (id, phone, full_name, nickname, email)
select auth_user.id,
       '+' || regexp_replace(coalesce(auth_user.raw_user_meta_data ->> 'phone', split_part(auth_user.email, '@', 1)), '\D', '', 'g'),
       left(btrim(coalesce(auth_user.raw_user_meta_data ->> 'full_name', '')), 120),
       left(btrim(coalesce(auth_user.raw_user_meta_data ->> 'nickname', '')), 60),
       auth_user.email
  from auth.users as auth_user
 where auth_user.email like '%@phone.deloci.app'
   and length(regexp_replace(coalesce(auth_user.raw_user_meta_data ->> 'phone', split_part(auth_user.email, '@', 1)), '\D', '', 'g')) between 8 and 15
   and nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '') is not null
   and nullif(btrim(auth_user.raw_user_meta_data ->> 'nickname'), '') is not null
on conflict (phone) do update
  set full_name = excluded.full_name,
      nickname = excluded.nickname,
      email = excluded.email
where public.users.id = excluded.id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'users_id_auth_users_fkey'
       and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_id_auth_users_fkey
      foreign key (id) references auth.users(id) on delete cascade not valid;
  end if;
end;
$$;

create or replace function public.auth_user_phone()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_user.phone from public.users as app_user where app_user.id = auth.uid() limit 1;
$$;

create or replace function public.auth_is_session_owner(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.checkin_sessions as session
     where session.id = target_session_id
       and (session.user_id = auth.uid() or session.user_phone = public.auth_user_phone())
  );
$$;

create or replace function public.auth_is_session_recipient(target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.session_recipients as recipient
     where recipient.session_id = target_session_id
       and (recipient.recipient_phone = public.auth_user_phone() or recipient.contact_phone = public.auth_user_phone())
  );
$$;

create or replace function public.auth_is_trusted_contact(target_phone text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.trusted_contacts as contact
     where contact.user_phone = public.auth_user_phone() and contact.phone = target_phone
  );
$$;

create or replace function public.auth_profile_is_session_sender(target_user_id uuid)
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
       and (recipient.recipient_phone = public.auth_user_phone() or recipient.contact_phone = public.auth_user_phone())
  );
$$;

create or replace function public.lookup_referrer(ref_code text)
returns table (full_name text, nickname text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select app_user.full_name, app_user.nickname
    from public.users as app_user
   where app_user.nickname = left(btrim(ref_code), 120)
      or app_user.phone = '+' || regexp_replace(coalesce(ref_code, ''), '\D', '', 'g')
   order by case when app_user.nickname = left(btrim(ref_code), 120) then 0 else 1 end
   limit 1;
$$;

revoke all on function public.auth_user_phone() from public;
revoke all on function public.auth_is_session_owner(uuid) from public;
revoke all on function public.auth_is_session_recipient(uuid) from public;
revoke all on function public.auth_is_trusted_contact(text) from public;
revoke all on function public.auth_profile_is_session_sender(uuid) from public;
revoke all on function public.lookup_referrer(text) from public;
grant execute on function public.auth_user_phone() to authenticated, service_role;
grant execute on function public.auth_is_session_owner(uuid) to authenticated, service_role;
grant execute on function public.auth_is_session_recipient(uuid) to authenticated, service_role;
grant execute on function public.auth_is_trusted_contact(text) to authenticated, service_role;
grant execute on function public.auth_profile_is_session_sender(uuid) to authenticated, service_role;
grant execute on function public.lookup_referrer(text) to anon, authenticated;

-- Remove policies tied to the old custom header and rebuild them around auth.uid().
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('users', 'trusted_contacts', 'checkin_sessions', 'session_recipients', 'notifications', 'user_push_subscriptions')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

alter table public.users drop column if exists pin_hash;

alter table public.users enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.checkin_sessions enable row level security;
alter table public.session_recipients enable row level security;
alter table public.notifications enable row level security;
alter table public.user_push_subscriptions enable row level security;
alter table public.referrals enable row level security;

revoke all on table public.users from public, anon, authenticated;
revoke all on table public.trusted_contacts from public, anon, authenticated;
revoke all on table public.checkin_sessions from public, anon, authenticated;
revoke all on table public.session_recipients from public, anon, authenticated;
revoke all on table public.notifications from public, anon, authenticated;
revoke all on table public.user_push_subscriptions from public, anon, authenticated;
revoke all on table public.referrals from public, anon, authenticated;
grant select (id, phone, full_name, nickname, email, avatar_url, created_at) on table public.users to authenticated;
grant update (full_name, nickname, email, avatar_url) on table public.users to authenticated;
grant select, insert, update, delete on table public.trusted_contacts to authenticated;
grant select, insert, update, delete on table public.checkin_sessions to authenticated;
grant select, insert, update, delete on table public.session_recipients to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant select, insert, update, delete on table public.user_push_subscriptions to authenticated;
grant select on table public.referrals to authenticated;

create policy users_select_self on public.users for select to authenticated using (id = auth.uid());
create policy users_select_trusted_contacts on public.users for select to authenticated using (public.auth_is_trusted_contact(phone));
create policy users_select_shared_session_participants on public.users for select to authenticated using (public.auth_profile_is_session_sender(id));
create policy users_update_self on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy trusted_contacts_select_owner on public.trusted_contacts for select to authenticated using (user_phone = public.auth_user_phone());
create policy trusted_contacts_insert_owner on public.trusted_contacts for insert to authenticated with check (user_phone = public.auth_user_phone());
create policy trusted_contacts_update_owner on public.trusted_contacts for update to authenticated using (user_phone = public.auth_user_phone()) with check (user_phone = public.auth_user_phone());
create policy trusted_contacts_delete_owner on public.trusted_contacts for delete to authenticated using (user_phone = public.auth_user_phone());

create policy checkin_sessions_select_owner on public.checkin_sessions for select to authenticated using (user_id = auth.uid() or user_phone = public.auth_user_phone());
create policy checkin_sessions_select_recipient on public.checkin_sessions for select to authenticated using (public.auth_is_session_recipient(id));
create policy checkin_sessions_insert_owner on public.checkin_sessions for insert to authenticated with check (user_id = auth.uid() and user_phone = public.auth_user_phone());
create policy checkin_sessions_update_owner on public.checkin_sessions for update to authenticated using (user_id = auth.uid() or user_phone = public.auth_user_phone()) with check (user_id = auth.uid() and user_phone = public.auth_user_phone());
create policy checkin_sessions_delete_owner on public.checkin_sessions for delete to authenticated using (user_id = auth.uid() or user_phone = public.auth_user_phone());

create policy session_recipients_select_owner_or_recipient on public.session_recipients for select to authenticated using (
  recipient_phone = public.auth_user_phone() or contact_phone = public.auth_user_phone() or public.auth_is_session_owner(session_id)
);
create policy session_recipients_insert_session_owner on public.session_recipients for insert to authenticated with check (
  public.auth_is_session_owner(session_id) and public.auth_is_trusted_contact(contact_phone) and contact_phone = recipient_phone
);
create policy session_recipients_update_session_owner on public.session_recipients for update to authenticated using (public.auth_is_session_owner(session_id)) with check (public.auth_is_session_owner(session_id));
create policy session_recipients_delete_session_owner on public.session_recipients for delete to authenticated using (public.auth_is_session_owner(session_id));

create policy notifications_select_owner on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_insert_owner on public.notifications for insert to authenticated with check (user_id = auth.uid() and (sender_id is null or sender_id = auth.uid()));
create policy notifications_update_owner on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_owner on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy user_push_subscriptions_select_owner on public.user_push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy user_push_subscriptions_insert_owner on public.user_push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy user_push_subscriptions_update_owner on public.user_push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_push_subscriptions_delete_owner on public.user_push_subscriptions for delete to authenticated using (user_id = auth.uid());

drop policy if exists referrals_select_referrer on public.referrals;
create policy referrals_select_referrer on public.referrals for select to authenticated
  using (referrer_phone = public.auth_user_phone());

-- The push Edge Function uses its service-role client; these tables no longer participate in user auth.
drop table if exists public.notification_app_sessions;
drop table if exists public.notification_pin_attempts;
drop function if exists public.begin_notification_pin_attempt(text);
drop function if exists public.reset_notification_pin_attempt(text);
drop function if exists public.current_app_user_id() cascade;
drop function if exists public.current_app_user_phone() cascade;
drop function if exists public.app_is_session_owner(uuid) cascade;
drop function if exists public.app_is_session_recipient(uuid) cascade;
drop function if exists public.app_is_trusted_contact(text) cascade;
drop function if exists public.app_profile_is_trusted_contact(uuid) cascade;
drop function if exists public.app_profile_is_session_sender(uuid) cascade;
