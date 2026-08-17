import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const TIME_ZONE = "Africa/Lagos";
const MAX_CANDIDATES = 20;

const POPULAR_LEAGUES = new Set([
  2, 3, 39, 45, 61, 66, 71, 78, 81, 88, 94, 128, 135, 137, 140, 143, 203, 253,
  307, 848,
]);

type JsonRecord = Record<string, unknown>;

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
  tip: string;
  confidence: number;
  odds: string;
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

function kickoffTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function poissonOver(totalGoals: number, line: number) {
  const maxGoals = Math.floor(line);
  let cumulative = 0;
  let factorial = 1;

  for (let goals = 0; goals <= maxGoals; goals += 1) {
    if (goals > 0) factorial *= goals;
    cumulative += Math.exp(-totalGoals) * totalGoals ** goals / factorial;
  }

  return Math.max(0.05, Math.min(0.9, 1 - cumulative));
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
  const runDate = lagosDate();
  let apiRequests = 0;
  let runId: number | undefined;

  const { data: run } = await supabase
    .from("ace_automation_runs")
    .insert({ run_date: runDate, status: "running" })
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
      `/fixtures?date=${encodeURIComponent(runDate)}&timezone=${encodeURIComponent(TIME_ZONE)}`,
    );
    const fixtures = ((fixtureBody.response ?? []) as Fixture[])
      .filter(fixtureIsSuitable)
      .filter((fixture) => lagosDate(new Date(fixture.fixture.date)) === runDate)
      .sort(
        (left, right) =>
          new Date(left.fixture.date).getTime() - new Date(right.fixture.date).getTime(),
      );

    const candidates = diversify(fixtures);
    const analysed: SelectedPrediction[] = [];
    const historyCache = new Map<number, { scored: number; conceded: number } | null>();

    async function teamForm(teamId: number) {
      if (historyCache.has(teamId)) return historyCache.get(teamId) ?? null;

      const body = await api(`/fixtures?team=${teamId}&last=5`);
      const history = ((body.response ?? []) as Fixture[]).filter(
        (match) => match.goals?.home != null && match.goals?.away != null,
      );
      if (history.length < 3) {
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

    for (const item of candidates.slice(0, MAX_CANDIDATES)) {
      try {
        const [home, away] = await Promise.all([
          teamForm(item.teams.home.id),
          teamForm(item.teams.away.id),
        ]);
        if (!home || !away) continue;

        const expectedHome = Math.max(0.2, ((home.scored + away.conceded) / 2) * 1.08);
        const expectedAway = Math.max(0.2, (away.scored + home.conceded) / 2);
        const expectedTotal = expectedHome + expectedAway;
        const over25 = poissonOver(expectedTotal, 2.5);
        const over35 = poissonOver(expectedTotal, 3.5);
        const bothTeamsScore =
          (1 - Math.exp(-expectedHome)) * (1 - Math.exp(-expectedAway));
        const combo = Math.min(over25, bothTeamsScore) * 0.9;
        const markets = [
          { tip: "Over 3.5 Goals", probability: over35, preference: 3 },
          { tip: "Over 2.5 & GG", probability: combo, preference: 2 },
          { tip: "Over 2.5 Goals", probability: over25, preference: 1 },
        ].filter(({ probability }) => probability >= 0.25);
        const market = markets.sort(
          (left, right) =>
            Math.abs(left.probability - 0.43) -
              Math.abs(right.probability - 0.43) ||
            right.preference - left.preference,
        )[0];
        if (!market) continue;

        // This is a model-quality score, deliberately kept in the requested
        // 80–95 display range; the estimated odds still use raw probability.
        const confidence = Math.min(
          95,
          Math.max(80, Math.round(80 + (market.probability - 0.25) * 35)),
        );
        const estimatedOdds = Math.min(6, 0.92 / market.probability).toFixed(2);
        analysed.push({
          fixtureId: item.fixture.id,
          leagueId: item.league.id,
          popular: POPULAR_LEAGUES.has(item.league.id),
          teamA: item.teams.home.name,
          teamB: item.teams.away.name,
          league: `${item.league.country} · ${item.league.name}`,
          kickoff: kickoffTime(item.fixture.date),
          tip: market.tip,
          confidence,
          odds: `Est. ${estimatedOdds}`,
          score:
            120 -
            Math.abs(market.probability - 0.43) * 100 +
            expectedTotal * 5 +
            market.preference * 3,
        });
      } catch {
        // Move to another league if a team has no recent-results coverage.
      }

      if (
        analysed.length >= 10 ||
        (analysed.filter((pick) => pick.popular).length >= 3 &&
          analysed.filter((pick) => !pick.popular).length >= 3)
      ) {
        break;
      }
    }

    analysed.sort((left, right) => right.score - left.score);
    const popular = analysed.filter((item) => item.popular);
    const emerging = analysed.filter((item) => !item.popular);
    const selected: SelectedPrediction[] = [];
    const usedLeagues = new Set<number>();

    const takeBest = (pool: SelectedPrediction[]) => {
      const pick =
        pool.find((item) => !usedLeagues.has(item.leagueId)) ??
        pool.find((item) => !selected.some((selectedItem) => selectedItem.fixtureId === item.fixtureId));
      if (!pick || selected.some((item) => item.fixtureId === pick.fixtureId)) return;
      selected.push(pick);
      usedLeagues.add(pick.leagueId);
    };

    for (const pool of [popular, emerging, popular, emerging, popular]) takeBest(pool);
    for (const pick of analysed) {
      if (selected.length >= 5) break;
      if (!selected.some((item) => item.fixtureId === pick.fixtureId)) selected.push(pick);
    }

    for (let index = 0; index < 5; index += 1) {
      const prediction = selected[index];
      const values = prediction
        ? {
            published: true,
            team_a: prediction.teamA,
            team_b: prediction.teamB,
            league: prediction.league,
            kickoff: prediction.kickoff,
            odds: prediction.odds,
            tip: prediction.tip,
            confidence: prediction.confidence,
            slip_image: null,
            source: "api-football",
            source_fixture_id: prediction.fixtureId,
            source_date: runDate,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            published: false,
            team_a: "",
            team_b: "",
            league: "",
            kickoff: "",
            odds: "",
            tip: "",
            confidence: 80,
            slip_image: null,
            source: "api-football",
            source_fixture_id: null,
            source_date: runDate,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

      // Keep each card's existing Monetag / direct-link unlock settings.
      const { error } = await supabase
        .from("ace_prediction_slots")
        .update(values)
        .eq("slot", index + 1);
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
              ? "Five daily predictions published"
              : `Only ${selected.length} supported predictions were available`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return Response.json({
      date: runDate,
      fixturesFound: fixtures.length,
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

    return Response.json({ error: message, date: runDate, apiRequests }, { status: 500 });
  }
});
