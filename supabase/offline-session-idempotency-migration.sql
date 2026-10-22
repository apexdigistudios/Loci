-- Allow offline session-start retries to resolve the original server row.
alter table public.checkin_sessions
  add column if not exists client_mutation_id text;

create unique index if not exists checkin_sessions_client_mutation_id_idx
  on public.checkin_sessions(client_mutation_id)
  where client_mutation_id is not null;