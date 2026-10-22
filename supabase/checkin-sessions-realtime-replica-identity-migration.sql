-- Include complete before/after rows in check-in session Realtime events.
alter table public.checkin_sessions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.checkin_sessions replica identity full;

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
    select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname = 'checkin_sessions'
       and relation.relreplident = 'f'
  ) then
    raise exception 'checkin_sessions replica identity is not FULL';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'checkin_sessions'
  ) then
    raise exception 'checkin_sessions is not in supabase_realtime';
  end if;
end;
$$;