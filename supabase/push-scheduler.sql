-- Configure Vault secrets named project_url and service_role_key before running this file.
-- Create the secrets in Supabase Vault; do not commit their values.
-- Deploy dispatch-push and set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT
-- as Supabase Edge Function secrets. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in the app environment.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'dispatch-deloci-push-alerts';

select cron.schedule(
  'dispatch-deloci-push-alerts',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/dispatch-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);