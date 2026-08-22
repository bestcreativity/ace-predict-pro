import { supabase } from "@/lib/supabase";

export type Match = {
  /** Stable key used for React keys: `${matchDate}-${slot}`. */
  id: string;
  matchDate: string;
  slot: number;
  published: boolean;
  teamA: string;
  teamB: string;
  league: string;
  kickoff: string;
  tipOver25: string;
  tipHighestHalf: string;
  adZoneId: string;
  adUrl: string;
  slipImage?: string;
  updatedAt: string;
};

export type DayMatches = {
  businessToday: string;
  businessTomorrow: string;
  today: Match[];
  tomorrow: Match[];
};

type MatchRow = {
  id: number;
  match_date: string;
  slot: number;
  published: boolean;
  team_a: string;
  team_b: string;
  league: string;
  kickoff: string;
  tip_over25: string;
  tip_highest_half: string;
  slip_image: string | null;
  ad_zone_id: string;
  ad_url: string;
  updated_at: string;
};

export const ADMIN_SESSION_KEY = "ace:admin";

function mapMatch(row: MatchRow): Match {
  return {
    id: `${row.match_date}-${row.slot}`,
    matchDate: row.match_date,
    slot: row.slot,
    published: row.published,
    teamA: row.team_a,
    teamB: row.team_b,
    league: row.league,
    kickoff: row.kickoff,
    tipOver25: row.tip_over25,
    tipHighestHalf: row.tip_highest_half,
    adZoneId: row.ad_zone_id ?? "",
    adUrl: row.ad_url ?? "",
    ...(row.slip_image ? { slipImage: row.slip_image } : {}),
    updatedAt: row.updated_at,
  };
}

/** Fetches both days of matches (business-day logic is applied server-side). */
export async function getMatchesByDay(): Promise<DayMatches> {
  const { data, error } = await supabase.rpc("get_ace_matches_by_day");
  if (error) throw error;

  const payload = data as {
    businessToday: string;
    businessTomorrow: string;
    today: MatchRow[];
    tomorrow: MatchRow[];
  };

  return {
    businessToday: payload.businessToday,
    businessTomorrow: payload.businessTomorrow,
    today: (payload.today ?? []).map(mapMatch),
    tomorrow: (payload.tomorrow ?? []).map(mapMatch),
  };
}

export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_ace_admin_passcode", {
    p_admin_passcode: passcode,
  });

  if (error) throw error;
  return data === true;
}

export type MatchInput = Omit<Match, "id" | "updatedAt">;

export async function saveMatch(passcode: string, match: MatchInput): Promise<Match> {
  const { data, error } = await supabase.rpc("manage_ace_match", {
    p_admin_passcode: passcode,
    p_match_date: match.matchDate,
    p_slot: match.slot,
    p_published: match.published,
    p_team_a: match.teamA,
    p_team_b: match.teamB,
    p_league: match.league,
    p_kickoff: match.kickoff,
    p_tip_over25: match.tipOver25,
    p_tip_highest_half: match.tipHighestHalf,
    p_ad_zone_id: match.adZoneId,
    p_ad_url: match.adUrl,
    p_slip_image: match.slipImage ?? null,
  });

  if (error) throw error;
  return mapMatch(data as MatchRow);
}

// ────────────────────────────────────────────────────────────────────────────
// Match history (weekly tracker) types & API
// ────────────────────────────────────────────────────────────────────────────

export type MatchResult = "pending" | "win" | "loss";

export type MatchHistoryEntry = {
  id: number;
  matchDate: string;
  slot: number;
  teamA: string;
  teamB: string;
  league: string;
  kickoff: string;
  tipOver25: string;
  tipHighestHalf: string;
  result: MatchResult;
};

type MatchHistoryRow = {
  id: number;
  match_date: string;
  slot: number;
  team_a: string;
  team_b: string;
  league: string;
  kickoff: string;
  tip_over25: string;
  tip_highest_half: string;
  result: MatchResult;
  created_at: string;
};

function mapMatchHistory(row: MatchHistoryRow): MatchHistoryEntry {
  return {
    id: row.id,
    matchDate: row.match_date,
    slot: row.slot,
    teamA: row.team_a,
    teamB: row.team_b,
    league: row.league,
    kickoff: row.kickoff,
    tipOver25: row.tip_over25,
    tipHighestHalf: row.tip_highest_half,
    result: row.result,
  };
}

/** Fetches archived match history for the past N days (default 7). */
export async function getMatchHistory(days: number = 7): Promise<MatchHistoryEntry[]> {
  const { data, error } = await supabase.rpc("ace_get_match_history", { p_days: days });
  if (error) throw error;
  return ((data as MatchHistoryRow[]) ?? []).map(mapMatchHistory);
}

/** Admin: mark an archived match as win / loss / pending. */
export async function setMatchResult(
  passcode: string,
  matchDate: string,
  slot: number,
  result: MatchResult,
): Promise<MatchHistoryEntry> {
  const { data, error } = await supabase.rpc("ace_set_match_result", {
    p_admin_passcode: passcode,
    p_match_date: matchDate,
    p_slot: slot,
    p_result: result,
  });
  if (error) throw error;
  return mapMatchHistory(data as MatchHistoryRow);
}

// ───────────────────────────────────────────────────────────────────────────
// Device install tracking
// ───────────────────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = "ace:device-id";

/** Stable per-browser/per-install identifier used for install counting. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = "";
  try {
    id = window.localStorage.getItem(DEVICE_ID_KEY) ?? "";
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
  } catch {
    return "";
  }
  return id;
}

/** Registers this device (counted as one install on first call). Never throws. */
export async function registerDevice(appVersion: string, platform: string): Promise<void> {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  await supabase.rpc("ace_register_device", {
    p_device_id: deviceId,
    p_app_version: appVersion,
    p_platform: platform,
  });
}

export type InstallStats = {
  totalInstalls: number;
  active7d: number;
  activeToday: number;
  androidInstalls: number;
};

/** Admin-only install/uninstall-proxy stats. */
export async function getInstallStats(passcode: string): Promise<InstallStats> {
  const { data, error } = await supabase.rpc("ace_get_install_stats", {
    p_admin_passcode: passcode,
  });
  if (error) throw error;
  return data as InstallStats;
}
