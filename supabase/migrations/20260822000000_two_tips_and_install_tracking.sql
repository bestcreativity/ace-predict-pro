-- ─────────────────────────────────────────────────────────────────────────────
-- Two changes:
--   1. Remove the Half/Full tip (matches now carry exactly two tips:
--      Over/Under 2.5 and Highest Scoring Half).
--   2. Add device install tracking (total installs + activity) for the admin.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the HT/FT tip column from live matches and archived history.
alter table public.ace_matches drop column if exists tip_halffull;
alter table public.ace_game_history drop column if exists tip_halffull;

-- 2. Recreate the admin upsert without the HT/FT parameter (new signature).
drop function if exists public.manage_ace_match(
  text, date, smallint, boolean, text, text, text, text, text, text, text, text, text, text
);

create or replace function public.manage_ace_match(
  p_admin_passcode   text,
  p_match_date       date,
  p_slot             smallint,
  p_published        boolean,
  p_team_a           text default '',
  p_team_b           text default '',
  p_league           text default '',
  p_kickoff          text default '',
  p_tip_over25       text default '',
  p_tip_highest_half text default '',
  p_ad_zone_id       text default '',
  p_ad_url           text default '',
  p_slip_image       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.ace_matches;
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
    nullif(trim(p_tip_over25), '') is null or
    nullif(trim(p_tip_highest_half), '') is null
  ) then
    raise exception 'Published matches require both teams and both tips' using errcode = '22023';
  end if;

  insert into public.ace_matches (
    match_date, slot, published, team_a, team_b, league, kickoff,
    tip_over25, tip_highest_half, ad_zone_id, ad_url, slip_image, updated_at
  ) values (
    p_match_date, p_slot, p_published,
    case when p_published then trim(p_team_a) else '' end,
    case when p_published then trim(p_team_b) else '' end,
    case when p_published then trim(p_league) else '' end,
    case when p_published then trim(p_kickoff) else '' end,
    case when p_published then trim(p_tip_over25) else '' end,
    case when p_published then trim(p_tip_highest_half) else '' end,
    case when p_published then coalesce(trim(p_ad_zone_id), '') else '' end,
    case when p_published then coalesce(trim(p_ad_url), '') else '' end,
    case when p_published then p_slip_image else null end,
    now()
  )
  on conflict (match_date, slot) do update set
    published        = excluded.published,
    team_a           = excluded.team_a,
    team_b           = excluded.team_b,
    league           = excluded.league,
    kickoff          = excluded.kickoff,
    tip_over25       = excluded.tip_over25,
    tip_highest_half = excluded.tip_highest_half,
    ad_zone_id       = excluded.ad_zone_id,
    ad_url           = excluded.ad_url,
    slip_image       = excluded.slip_image,
    updated_at       = now()
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

revoke all on function public.manage_ace_match(
  text, date, smallint, boolean, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.manage_ace_match(
  text, date, smallint, boolean, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- 3. Recreate the nightly archiver without the HT/FT column.
create or replace function public.ace_archive_day(p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ace_game_history (
    match_date, slot, team_a, team_b, league, kickoff,
    tip_over25, tip_highest_half, result
  )
  select
    match_date, slot, team_a, team_b, league, kickoff,
    tip_over25, tip_highest_half, 'pending'
  from public.ace_matches
  where match_date = p_date
    and published = true
    and nullif(trim(team_a), '') is not null
  on conflict (match_date, slot) do update set
    team_a           = excluded.team_a,
    team_b           = excluded.team_b,
    league           = excluded.league,
    kickoff          = excluded.kickoff,
    tip_over25       = excluded.tip_over25,
    tip_highest_half = excluded.tip_highest_half;

  delete from public.ace_matches where match_date = p_date;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Device install tracking.
--    Every app open upserts the device's row; first_seen counts as the install.
--    True uninstall detection is impossible from inside the app (needs Firebase
--    push), so "inactive 7+ days" is used as the uninstall proxy.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ace_device_installs (
  device_id   text        primary key,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  app_version text        not null default '',
  platform    text        not null default 'web'
);

alter table public.ace_device_installs enable row level security;
-- No direct table access; everything goes through the functions below.

create or replace function public.ace_register_device(
  p_device_id   text,
  p_app_version text default '',
  p_platform    text default 'web'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_device_id), '') is null then
    return;
  end if;

  insert into public.ace_device_installs (device_id, app_version, platform)
  values (trim(p_device_id), coalesce(trim(p_app_version), ''), coalesce(trim(p_platform), 'web'))
  on conflict (device_id) do update set
    last_seen   = now(),
    app_version = case
      when nullif(trim(excluded.app_version), '') is not null then excluded.app_version
      else public.ace_device_installs.app_version
    end,
    platform    = case
      when excluded.platform <> 'web' then excluded.platform
      else public.ace_device_installs.platform
    end;
end;
$$;

revoke all on function public.ace_register_device(text, text, text) from public;
grant execute on function public.ace_register_device(text, text, text) to anon, authenticated;

create or replace function public.ace_get_install_stats(p_admin_passcode text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expected_hash constant text := 'd6185f398d70f2956adbe828e6a703c7b113129c575819f99d412e1176b74619';
begin
  if encode(extensions.digest(convert_to(p_admin_passcode, 'UTF8'), 'sha256'), 'hex') <> v_expected_hash then
    raise exception 'Invalid admin passcode' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'totalInstalls', (select count(*) from public.ace_device_installs),
    'active7d', (select count(*) from public.ace_device_installs where last_seen >= now() - interval '7 days'),
    'activeToday', (select count(*) from public.ace_device_installs where last_seen >= now() - interval '1 day'),
    'androidInstalls', (select count(*) from public.ace_device_installs where platform = 'android')
  );
end;
$$;

revoke all on function public.ace_get_install_stats(text) from public;
grant execute on function public.ace_get_install_stats(text) to anon, authenticated;
