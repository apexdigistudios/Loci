-- Retire the legacy scheduler. The current client alert loop dispatches through
-- send-push with a verified notification session; the old cron posted an
-- unsupported {"action":"dispatch"} payload every minute.
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'dispatch-deloci-push-alerts';