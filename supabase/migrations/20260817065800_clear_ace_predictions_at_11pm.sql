select cron.unschedule(jobid)
from cron.job
where jobname = 'ace-clear-daily-predictions';

-- pg_cron uses UTC. 22:00 UTC is 23:00 in Lagos (WAT).
select cron.schedule(
  'ace-clear-daily-predictions',
  '0 22 * * *',
  $job$
  update public.ace_prediction_slots
  set
    published = false,
    team_a = '',
    team_b = '',
    league = '',
    kickoff = '',
    odds = '',
    tip = '',
    confidence = 80,
    slip_image = null,
    source = 'daily-clear',
    source_fixture_id = null,
    source_date = null,
    generated_at = null,
    updated_at = now();
  $job$
);
