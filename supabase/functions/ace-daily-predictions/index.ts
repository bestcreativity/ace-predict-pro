import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://v3.football.api-sports.io";
const TIME_ZONE = "Africa/Lagos";
const MAX_PREDICTION_REQUESTS = 30;

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
    home: { name: string };
    away: { name: string };
  };
};

type SelectedPrediction = {
  fixtureId: number;
  teamA: string;
  teamB: string;
  league: string;
  kickoff: string;
  tip: string;
  confidence: number;
  odds: string;
};

function lagosDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

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

function percentage(value: unknown) {
  const parsed = Number.parseInt(String(value ?? "").replace("%", ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function predictionConfidence(
  advice: string,
  percentages: JsonRecord,
  homeTeam: string,
  awayTeam: string,
) {
  const home = percentage(percentages.home);
  const draw = percentage(percentages.draw);
  const away = percentage(percentages.away);
  const normalized = advice.toLowerCase();
  const coversDraw = normalized.includes("draw");
  const coversHome = normalized.includes(homeTeam.toLowerCase());
  const coversAway = normalized.includes(awayTeam.toLowerCase());

  if (normalized.includes("double chance") || normalized.includes("combo")) {
    if (coversHome && coversDraw) return home + draw;
    if (coversAway && coversDraw) return away + draw;
    if (coversHome && coversAway) return home + away;
  }

  return Math.max(home, draw, away);
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
      .sort(
        (left, right) =>
          new Date(left.fixture.date).getTime() - new Date(right.fixture.date).getTime(),
      );

    const candidates = diversify(fixtures);
    const selected: SelectedPrediction[] = [];
    let predictionRequests = 0;

    for (const item of candidates) {
      if (selected.length >= 5 || predictionRequests >= MAX_PREDICTION_REQUESTS) break;
      predictionRequests += 1;

      try {
        const predictionBody = await api(`/predictions?fixture=${item.fixture.id}`);
        const prediction = (predictionBody.response as JsonRecord[] | undefined)?.[0];
        const pick = prediction?.predictions as JsonRecord | undefined;
        const percentages = pick?.percent as JsonRecord | undefined;
        const advice = String(pick?.advice ?? "").trim();

        const confidence = predictionConfidence(
          advice,
          percentages ?? {},
          item.teams.home.name,
          item.teams.away.name,
        );

        if (!advice || confidence < 45) continue;

        // API-Football predictions do not provide bookmaker odds. This is a
        // conservative model estimate and is labelled as such in the UI.
        const estimatedOdds = Math.min(4, Math.max(1.15, 92 / confidence)).toFixed(2);

        selected.push({
          fixtureId: item.fixture.id,
          teamA: item.teams.home.name,
          teamB: item.teams.away.name,
          league: `${item.league.country} · ${item.league.name}`,
          kickoff: kickoffTime(item.fixture.date),
          tip: advice,
          confidence: Math.min(95, confidence),
          odds: `Est. ${estimatedOdds}`,
        });
      } catch {
        // Some small leagues do not have enough data for API-Football's
        // prediction endpoint. Continue until five supported matches are found.
      }
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
