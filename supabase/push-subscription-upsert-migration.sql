-- Required by the client upsert conflict target (user_id, endpoint).
alter table public.user_push_subscriptions
  drop constraint if exists user_push_subscriptions_endpoint_key;

drop index if exists public.user_push_subscriptions_endpoint_key;

create unique index if not exists user_push_subscriptions_user_endpoint_key
  on public.user_push_subscriptions(user_id, endpoint);