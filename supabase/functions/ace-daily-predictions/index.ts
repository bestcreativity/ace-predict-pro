import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const TIME_ZONE = "Africa/Lagos";
/** Keeps one nightly run inside the free plan's 100 requests per day. */
const MAX_API_REQUESTS = 70;
/** Used when a team has no recent results, so a card is never left empty. */
const BASELINE_FORM = { scored: 1.35, conceded: 1.35 };
/** Rough share of a match's goals scored in the first half. */
const FIRST_HALF_GOAL_SHARE = 0.45;

const POPULAR_LEAGUES = new Set([
  2, 3, 39, 45, 61, 66, 71, 78, 81, 88, 94, 128, 135, 137, 140, 143, 203, 253,
  307, 848,
]);

type JsonRecord = Record<string, unknown>;

type TeamGoals = { scored: number; conceded: number };

type StandingRow = {
  team: { id: number };
  all?: { played?: number; goals?: { for?: number; against?: number } };
};

type Fixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: {
    id: number;
    name: string;
    country: string;
    type?: string;
    season?: number;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals?: { home: number | null; away: number | null };
};

type SelectedPrediction = {
  fixtureId: number;
  leagueId: number;
  popular: boolean;
  teamA: string;
  teamB: string;
  league: string;
  kickoff: string;
  tipOver25: string;
  tipHighestHalf: string;
  score: number;
};

function lagosDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function kickoffTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function factorial(n: number) {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function poisson(lambda: number, k: number) {
  return (Math.exp(-lambda) * lambda ** k) / factorial(k);
}

function poissonOver(totalGoals: number, line: number) {
  const maxGoals = Math.floor(line);
  let cumulative = 0;
  for (let goals = 0; goals <= maxGoals; goals += 1) {
    cumulative += poisson(totalGoals, goals);
  }
  return Math.max(0.05, Math.min(0.95, 1 - cumulative));
}

/** Home / draw / away probabilities from expected goals via a Poisson grid. */
function outcomeProbabilities(expectedHome: number, expectedAway: number) {
  let home = 0;
  let draw = 0;
  let away = 0;
  const maxGoals = 6;
  for (let h = 0; h <= maxGoals; h += 1) {
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = poisson(expectedHome, h) * poisson(expectedAway, a);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away || 1;
  return { home: home / total, draw: draw / total, away: away / total };
}

function labelFromOutcome(outcome: { home: number; draw: number; away: number }) {
  if (outcome.home >= outcome.draw && outcome.home >= outcome.away) return "Home";
  if (outcome.away >= outcome.draw && outcome.away >= outcome.home) return "Away";
  return "Draw";
}

/** Over/Under 2.5 goals tip. */
function tipOver25(expectedTotal: number) {
  return poissonOver(expectedTotal, 2.5) >= 0.5 ? "Over 2.5" : "Under 2.5";
}

/** Which half is expected to produce more goals. */
function tipHighestHalf(expectedTotal: number) {
  const expFirst = expectedTotal * FIRST_HALF_GOAL_SHARE;
  const expSecond = expectedTotal * (1 - FIRST_HALF_GOAL_SHARE);
  let first = 0;
  let second = 0;
  let equal = 0;
  const maxGoals = 6;
  for (let g1 = 0; g1 <= maxGoals; g1 += 1) {
    for (let g2 = 0; g2 <= maxGoals; g2 += 1) {
      const p = poisson(expFirst, g1) * poisson(expSecond, g2);
      if (g1 > g2) first += p;
      else if (g2 > g1) second += p;
      else equal += p;
    }
  }
  if (second >= first && second >= equal) return "2nd Half";
  if (first >= second && first >= equal) return "1st Half";
  return "Both Equal";
}

function fixtureIsSuitable(item: Fixture) {
  if (!["NS", "TBD"].includes(item.fixture.status.short)) return false;

  const description = `${item.league.name} ${item.teams.home.name} ${item.teams.away.name}`;
  return !/\b(women|woman|female|youth|u-?\d{2}|reserve|reserves|friendly|amateur)\b/i.test(
    description,
  );
}

function diversify(fixtures: Fixture[]) {
  const popular = fixtures.filter((item) => POPULAR_LEAGUES.has(item.league.id));
  const emerging = fixtures.filter((item) => !POPULAR_LEAGUES.has(item.league.id));
  const queue: Fixture[] = [];
  const pattern = [popular, emerging, popular, emerging, popular];
  const seenFixtures = new Set<number>();
  const usedLeagues = new Set<number>();

  const take = (pool: Fixture[]) => {
    const uniqueLeague = pool.find(
      (item) => !seenFixtures.has(item.fixture.id) && !usedLeagues.has(item.league.id),
    );
    const next = uniqueLeague ?? pool.find((item) => !seenFixtures.has(item.fixture.id));
    if (!next) return;
    queue.push(next);
    seenFixtures.add(next.fixture.id);
    usedLeagues.add(next.league.id);
  };

  for (const pool of pattern) take(pool);
  for (const item of [...popular, ...emerging]) {
    if (!seenFixtures.has(item.fixture.id)) queue.push(item);
  }

  return queue;
}

Deno.serve(async (request: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Supabase environment is unavailable" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cronSecret = request.headers.get("x-cron-secret") ?? "";
  const { data: secrets, error: secretError } = await supabase.rpc(
    "get_ace_automation_secrets",
    { p_cron_secret: cronSecret },
  );

  if (secretError || !secrets?.[0]?.api_football_key) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = String(secrets[0].api_football_key);

  // The caller can target a specific date; default to tomorrow (Lagos).
  let targetDate = lagosDate();
  try {
    const body = (await request.json()) as JsonRecord;
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      targetDate = body.date;
    } else {
      targetDate = addDays(lagosDate(), 1);
    }
  } catch {
    targetDate = addDays(lagosDate(), 1);
  }

  let apiRequests = 0;
  let runId: number | undefined;

  const { data: run } = await supabase
    .from("ace_automation_runs")
    .insert({ run_date: targetDate, status: "running" })
    .select("id")
    .single();
  runId = run?.id;

  async function api(path: string): Promise<JsonRecord> {
    apiRequests += 1;
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { "x-apisports-key": apiKey },
    });

    if (!response.ok) {
      throw new Error(`API-Football returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as JsonRecord;
    const errors = body.errors as JsonRecord | undefined;
    if (errors && Object.keys(errors).length > 0) {
      throw new Error(`API-Football: ${JSON.stringify(errors)}`);
    }
    return body;
  }

  try {
    const fixtureBody = await api(
      `/fixtures?date=${encodeURIComponent(targetDate)}&timezone=${encodeURIComponent(TIME_ZONE)}`,
    );
    const fixtures = ((fixtureBody.response ?? []) as Fixture[])
      .filter(fixtureIsSuitable)
      .filter((fixture) => lagosDate(new Date(fixture.fixture.date)) === targetDate)
      .sort(
        (left, right) =>
          new Date(left.fixture.date).getTime() - new Date(right.fixture.date).getTime(),
      );

    const candidates = diversify(fixtures);
    const analysed: SelectedPrediction[] = [];
    const historyCache = new Map<number, TeamGoals | null>();
    const standingsCache = new Map<string, Map<number, TeamGoals> | null>();

    async function leagueGoals(leagueId: number, season?: number) {
      if (!season) return null;
      const key = `${leagueId}:${season}`;
      if (standingsCache.has(key)) return standingsCache.get(key) ?? null;

      try {
        const body = await api(`/standings?league=${leagueId}&season=${season}`);
        const league = ((body.response ?? []) as JsonRecord[])[0]?.league as
          | { standings?: StandingRow[][] }
          | undefined;
        const table = new Map<number, TeamGoals>();

        for (const group of league?.standings ?? []) {
          for (const row of group) {
            const played = Number(row.all?.played ?? 0);
            const scored = Number(row.all?.goals?.for ?? 0);
            const conceded = Number(row.all?.goals?.against ?? 0);
            if (played < 3) continue;
            table.set(row.team.id, { scored: scored / played, conceded: conceded / played });
          }
        }

        const result = table.size > 0 ? table : null;
        standingsCache.set(key, result);
        return result;
      } catch {
        standingsCache.set(key, null);
        return null;
      }
    }

    async function teamForm(teamId: number) {
      if (historyCache.has(teamId)) return historyCache.get(teamId) ?? null;

      const body = await api(`/fixtures?team=${teamId}&last=5`);
      const history = ((body.response ?? []) as Fixture[]).filter(
        (match) => match.goals?.home != null && match.goals?.away != null,
      );
      if (history.length === 0) {
        historyCache.set(teamId, null);
        return null;
      }

      let scored = 0;
      let conceded = 0;
      for (const match of history) {
        const wasHome = match.teams.home.id === teamId;
        scored += Number(wasHome ? match.goals?.home : match.goals?.away);
        conceded += Number(wasHome ? match.goals?.away : match.goals?.home);
      }

      const form = { scored: scored / history.length, conceded: conceded / history.length };
      historyCache.set(teamId, form);
      return form;
    }

    function buildPick(
      item: Fixture,
      home: TeamGoals,
      away: TeamGoals,
      modelled: boolean,
    ): SelectedPrediction {
      const expectedHome = Math.max(0.2, ((home.scored + away.conceded) / 2) * 1.08);
      const expectedAway = Math.max(0.2, (away.scored + home.conceded) / 2);
      const expectedTotal = expectedHome + expectedAway;

      return {
        fixtureId: item.fixture.id,
        leagueId: item.league.id,
        popular: POPULAR_LEAGUES.has(item.league.id),
        teamA: item.teams.home.name,
        teamB: item.teams.away.name,
        league: `${item.league.country} · ${item.league.name}`,
        kickoff: kickoffTime(item.fixture.date),
        tipOver25: tipOver25(expectedTotal),
        tipHighestHalf: tipHighestHalf(expectedTotal),
        score: (modelled ? 120 : 40) + expectedTotal * 5,
      };
    }

    for (const item of candidates) {
      if (analysed.length >= 12 || apiRequests >= MAX_API_REQUESTS) break;

      try {
        const table = await leagueGoals(item.league.id, item.league.season);
        let home = table?.get(item.teams.home.id) ?? null;
        let away = table?.get(item.teams.away.id) ?? null;

        if (!home || !away) {
          [home, away] = await Promise.all([
            home ? Promise.resolve(home) : teamForm(item.teams.home.id),
            away ? Promise.resolve(away) : teamForm(item.teams.away.id),
          ]);
        }

        if (!home && !away) continue;
        analysed.push(
          buildPick(item, home ?? BASELINE_FORM, away ?? BASELINE_FORM, true),
        );
      } catch {
        // Move on when a team has no goal-scoring coverage at all.
      }
    }

    // Every slot must carry a match, so any fixture left unanalysed is priced
    // from the baseline model.
    for (const item of candidates) {
      if (analysed.length >= 12) break;
      if (analysed.some((pick) => pick.fixtureId === item.fixture.id)) continue;
      analysed.push(buildPick(item, BASELINE_FORM, BASELINE_FORM, false));
    }

    analysed.sort((left, right) => right.score - left.score);
    const popular = analysed.filter((item) => item.popular);
    const emerging = analysed.filter((item) => !item.popular);
    const selected: SelectedPrediction[] = [];
    const usedLeagues = new Set<number>();

    const takeBest = (pool: SelectedPrediction[]) => {
      const pick =
        pool.find((item) => !usedLeagues.has(item.leagueId)) ??
        pool.find((item) => !selected.some((s) => s.fixtureId === item.fixtureId));
      if (!pick || selected.some((item) => item.fixtureId === pick.fixtureId)) return;
      selected.push(pick);
      usedLeagues.add(pick.leagueId);
    };

    for (const pool of [popular, emerging, popular, emerging, popular]) takeBest(pool);
    for (const pick of analysed) {
      if (selected.length >= 5) break;
      if (!selected.some((item) => item.fixtureId === pick.fixtureId)) selected.push(pick);
    }

    // Clear any existing rows for the target date, then write the fresh five.
    const { error: clearError } = await supabase
      .from("ace_matches")
      .delete()
      .eq("match_date", targetDate)
      .eq("source", "api-football");
    if (clearError) throw clearError;

    for (let index = 0; index < 5; index += 1) {
      const prediction = selected[index];
      const values = prediction
        ? {
            match_date: targetDate,
            slot: index + 1,
            published: true,
            team_a: prediction.teamA,
            team_b: prediction.teamB,
            league: prediction.league,
            kickoff: prediction.kickoff,
            tip_over25: prediction.tipOver25,
            tip_highest_half: prediction.tipHighestHalf,
            slip_image: null,
            source: "api-football",
            source_fixture_id: prediction.fixtureId,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            match_date: targetDate,
            slot: index + 1,
            published: false,
            team_a: "",
            team_b: "",
            league: "",
            kickoff: "",
            tip_over25: "",
            tip_highest_half: "",
            slip_image: null,
            source: "api-football",
            source_fixture_id: null,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

      const { error } = await supabase
        .from("ace_matches")
        .upsert(values, { onConflict: "match_date,slot" });
      if (error) throw error;
    }

    if (runId) {
      await supabase
        .from("ace_automation_runs")
        .update({
          status: "completed",
          selected_count: selected.length,
          api_requests: apiRequests,
          message:
            selected.length === 5
              ? `Five predictions published for ${targetDate}`
              : `Only ${selected.length} fixtures were available for ${targetDate}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return Response.json({
      date: targetDate,
      fixturesFound: fixtures.length,
      analysed: analysed.length,
      selected: selected.length,
      apiRequests,
      predictions: selected,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation failed";
    if (runId) {
      await supabase
        .from("ace_automation_runs")
        .update({
          status: "failed",
          api_requests: apiRequests,
          message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return Response.json({ error: message, date: targetDate, apiRequests }, { status: 500 });
  }
});
