-- ──────────────────────────────────────────────────────────────────────────────
-- Update the nightly clear cron to FIRST archive predictions into game history,
-- then clear the slots as before. Runs at 22:00 UTC (23:00 Lagos).
-- ──────────────────────────────────────────────────────────────────────────────

select cron.unschedule(jobid)
from cron.job
where jobname = 'ace-clear-daily-predictions';

select cron.schedule(
  'ace-clear-daily-predictions',
  '0 22 * * *',
  $job$
  -- Step 1: Archive today's published predictions into game history
  select public.ace_archive_game_history();

  -- Step 2: Clear the prediction slots (same logic as before)
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
