select cron.unschedule(jobid)
from cron.job
where jobname = 'ace-daily-predictions';

-- pg_cron uses UTC. 23:00 UTC is 00:00 the next day in Lagos (WAT).
select cron.schedule(
  'ace-daily-predictions',
  '0 23 * * *',
  $job$
  select net.http_post(
    url := 'https://cvpjzaiurdpdvgostjqj.supabase.co/functions/v1/ace-daily-predictions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'ace_automation_cron_secret'
        limit 1
      )
    ),
    body := jsonb_build_object('scheduled', true)
  );
  $job$
);
