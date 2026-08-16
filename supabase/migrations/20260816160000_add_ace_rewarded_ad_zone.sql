alter table public.ace_prediction_slots
  add column if not exists ad_zone_id text not null default '';

drop function if exists public.manage_ace_prediction_slot(
  text, smallint, boolean, text, text, text, text, text, text, smallint, text, text
);

create or replace function public.manage_ace_prediction_slot(
  p_admin_passcode text,
  p_slot smallint,
  p_published boolean,
  p_team_a text default '',
  p_team_b text default '',
  p_league text default '',
  p_kickoff text default '',
  p_odds text default '',
  p_tip text default '',
  p_confidence smallint default 80,
  p_ad_url text default '',
  p_slip_image text default null,
  p_ad_zone_id text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.ace_prediction_slots;
  v_expected_hash constant text := 'd6185f398d70f2956adbe828e6a703c7b113129c575819f99d412e1176b74619';
begin
  if encode(extensions.digest(convert_to(p_admin_passcode, 'UTF8'), 'sha256'), 'hex') <> v_expected_hash then
    raise exception 'Invalid admin passcode' using errcode = '28000';
  end if;

  if p_slot not between 1 and 5 then
    raise exception 'Slot must be between 1 and 5' using errcode = '22023';
  end if;

  if p_published and (
    nullif(trim(p_team_a), '') is null or
    nullif(trim(p_team_b), '') is null or
    nullif(trim(p_league), '') is null or
    nullif(trim(p_kickoff), '') is null or
    nullif(trim(p_odds), '') is null or
    nullif(trim(p_tip), '') is null
  ) then
    raise exception 'Published slots require complete match details' using errcode = '22023';
  end if;

  if p_published and nullif(trim(p_ad_zone_id), '') is null and nullif(trim(p_ad_url), '') is null then
    raise exception 'Published slots require a rewarded ad zone ID or a direct ad link' using errcode = '22023';
  end if;

  if p_published and nullif(trim(p_ad_zone_id), '') is not null and trim(p_ad_zone_id) !~ '^[0-9]{3,12}$' then
    raise exception 'Rewarded ad zone ID must be numeric' using errcode = '22023';
  end if;

  if p_published and nullif(trim(p_ad_url), '') is not null and p_ad_url !~ '^https://' then
    raise exception 'Ad URL must begin with https://' using errcode = '22023';
  end if;

  update public.ace_prediction_slots
  set
    published = p_published,
    team_a = case when p_published then trim(p_team_a) else '' end,
    team_b = case when p_published then trim(p_team_b) else '' end,
    league = case when p_published then trim(p_league) else '' end,
    kickoff = case when p_published then trim(p_kickoff) else '' end,
    odds = case when p_published then trim(p_odds) else '' end,
    tip = case when p_published then trim(p_tip) else '' end,
    confidence = case when p_published then p_confidence else 80 end,
    ad_url = case when p_published then coalesce(trim(p_ad_url), '') else '' end,
    ad_zone_id = case when p_published then coalesce(trim(p_ad_zone_id), '') else '' end,
    slip_image = case when p_published then p_slip_image else null end,
    updated_at = now()
  where slot = p_slot
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all on function public.manage_ace_prediction_slot(
  text, smallint, boolean, text, text, text, text, text, text, smallint, text, text, text
) from public;
grant execute on function public.manage_ace_prediction_slot(
  text, smallint, boolean, text, text, text, text, text, text, smallint, text, text, text
) to anon, authenticated;
