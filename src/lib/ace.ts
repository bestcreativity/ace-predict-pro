import { supabase } from "@/lib/supabase";

export type Prediction = {
  id: string;
  slot: number;
  published: boolean;
  teamA: string;
  teamB: string;
  league: string;
  kickoff: string;
  odds: string;
  tip: string;
  confidence: number;
  adZoneId: string;
  adUrl: string;
  slipImage?: string;
  updatedAt: string;
};

export const EMPTY_PREDICTION_SLOTS: Prediction[] = Array.from({ length: 5 }, (_, index) => ({
  id: `slot-${index + 1}`,
  slot: index + 1,
  published: false,
  teamA: "",
  teamB: "",
  league: "",
  kickoff: "",
  odds: "",
  tip: "",
  confidence: 80,
  adZoneId: "",
  adUrl: "",
  updatedAt: "",
}));

type PredictionRow = {
  slot: number;
  published: boolean;
  team_a: string;
  team_b: string;
  league: string;
  kickoff: string;
  odds: string;
  tip: string;
  confidence: number;
  ad_zone_id: string;
  ad_url: string;
  slip_image: string | null;
  updated_at: string;
};

const UNLOCK_KEY = "ace:unlocked";
export const ADMIN_SESSION_KEY = "ace:admin";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getUnlocked(): string[] {
  return read<string[]>(UNLOCK_KEY, []);
}

export function unlock(id: string): string[] {
  const next = Array.from(new Set([...getUnlocked(), id]));
  window.localStorage.setItem(UNLOCK_KEY, JSON.stringify(next));
  return next;
}

function mapPrediction(row: PredictionRow): Prediction {
  return {
    id: `slot-${row.slot}`,
    slot: row.slot,
    published: row.published,
    teamA: row.team_a,
    teamB: row.team_b,
    league: row.league,
    kickoff: row.kickoff,
    odds: row.odds,
    tip: row.tip,
    confidence: row.confidence,
    adZoneId: row.ad_zone_id ?? "",
    adUrl: row.ad_url,
    ...(row.slip_image ? { slipImage: row.slip_image } : {}),
    updatedAt: row.updated_at,
  };
}

export async function getPredictionSlots(): Promise<Prediction[]> {
  const { data, error } = await supabase
    .from("ace_prediction_slots")
    .select("*")
    .order("slot", { ascending: true });

  if (error) throw error;
  return (data as PredictionRow[]).map(mapPrediction);
}

export async function verifyAdminPasscode(passcode: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_ace_admin_passcode", {
    p_admin_passcode: passcode,
  });

  if (error) throw error;
  return data === true;
}

export type PredictionSlotInput = Omit<Prediction, "id" | "updatedAt">;

export async function savePredictionSlot(
  passcode: string,
  prediction: PredictionSlotInput,
): Promise<Prediction> {
  const { data, error } = await supabase.rpc("manage_ace_prediction_slot", {
    p_admin_passcode: passcode,
    p_slot: prediction.slot,
    p_published: prediction.published,
    p_team_a: prediction.teamA,
    p_team_b: prediction.teamB,
    p_league: prediction.league,
    p_kickoff: prediction.kickoff,
    p_odds: prediction.odds,
    p_tip: prediction.tip,
    p_confidence: prediction.confidence,
    p_ad_zone_id: prediction.adZoneId,
    p_ad_url: prediction.adUrl,
    p_slip_image: prediction.slipImage ?? null,
  });

  if (error) throw error;
  return mapPrediction(data as PredictionRow);
}