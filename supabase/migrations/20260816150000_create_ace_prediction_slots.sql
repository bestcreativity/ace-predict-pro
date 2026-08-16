create table public.ace_prediction_slots (
  slot smallint primary key check (slot between 1 and 5),
  published boolean not null default false,
  team_a text not null default '',
  team_b text not null default '',
  league text not null default '',
  kickoff text not null default '',
  odds text not null default '',
  tip text not null default '',
  confidence smallint not null default 80 check (confidence between 1 and 100),
  ad_url text not null default '',
  slip_image text,
  updated_at timestamptz not null default now()
);

alter table public.ace_prediction_slots enable row level security;

create policy "Anyone can read ACE prediction slots"
on public.ace_prediction_slots
for select
to anon, authenticated
using (true);

grant select on public.ace_prediction_slots to anon, authenticated;
revoke insert, update, delete on public.ace_prediction_slots from anon, authenticated;

insert into public.ace_prediction_slots (slot)
select generate_series(1, 5);

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
  p_slip_image text default null
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
    nullif(trim(p_tip), '') is null or
    nullif(trim(p_ad_url), '') is null
  ) then
    raise exception 'Published slots require complete match details and an ad URL' using errcode = '22023';
  end if;

  if p_published and p_ad_url !~ '^https://' then
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
    ad_url = case when p_published then trim(p_ad_url) else '' end,
    slip_image = case when p_published then p_slip_image else null end,
    updated_at = now()
  where slot = p_slot
  returning * into v_result;

  return to_jsonb(v_result);
end;
$$;

create or replace function public.verify_ace_admin_passcode(p_admin_passcode text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_admin_passcode, 'UTF8'), 'sha256'), 'hex') =
    'd6185f398d70f2956adbe828e6a703c7b113129c575819f99d412e1176b74619';
$$;

revoke all on function public.manage_ace_prediction_slot(
  text, smallint, boolean, text, text, text, text, text, text, smallint, text, text
) from public;
grant execute on function public.manage_ace_prediction_slot(
  text, smallint, boolean, text, text, text, text, text, text, smallint, text, text
) to anon, authenticated;

revoke all on function public.verify_ace_admin_passcode(text) from public;
grant execute on function public.verify_ace_admin_passcode(text) to anon, authenticated;
