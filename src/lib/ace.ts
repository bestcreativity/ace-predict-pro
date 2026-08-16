export type Prediction = {
  id: string;
  teamA: string;
  teamB: string;
  league: string;
  kickoff: string;
  day: DayKey;
  odds: string;
  tip: string;
  confidence: number;
  vip: boolean;
  slipImage?: string;
};

export type DayKey = "today" | "tomorrow" | "sat" | "sun";

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const BASE_PREDICTIONS: Prediction[] = [
  {
    id: "p1",
    teamA: "Arsenal",
    teamB: "Chelsea",
    league: "Premier League",
    kickoff: "17:30",
    day: "today",
    odds: "1.80",
    tip: "Home Win",
    confidence: 88,
    vip: false,
  },
  {
    id: "p2",
    teamA: "Inter",
    teamB: "Napoli",
    league: "Serie A",
    kickoff: "20:45",
    day: "today",
    odds: "1.65",
    tip: "Over 2.5 Goals",
    confidence: 76,
    vip: false,
  },
  {
    id: "p3",
    teamA: "Real Madrid",
    teamB: "Sevilla",
    league: "La Liga",
    kickoff: "21:00",
    day: "today",
    odds: "2.10",
    tip: "Home Win & Over 1.5",
    confidence: 92,
    vip: true,
  },
  {
    id: "p4",
    teamA: "Bayern",
    teamB: "Leipzig",
    league: "Bundesliga",
    kickoff: "18:30",
    day: "tomorrow",
    odds: "1.95",
    tip: "Both Teams To Score",
    confidence: 81,
    vip: false,
  },
  {
    id: "p5",
    teamA: "PSG",
    teamB: "Marseille",
    league: "Ligue 1",
    kickoff: "20:00",
    day: "tomorrow",
    odds: "2.35",
    tip: "Home -1 Handicap",
    confidence: 85,
    vip: true,
  },
  {
    id: "p6",
    teamA: "Ajax",
    teamB: "PSV",
    league: "Eredivisie",
    kickoff: "16:45",
    day: "sat",
    odds: "1.72",
    tip: "Draw No Bet — Away",
    confidence: 74,
    vip: false,
  },
  {
    id: "p7",
    teamA: "Benfica",
    teamB: "Porto",
    league: "Primeira Liga",
    kickoff: "19:15",
    day: "sat",
    odds: "2.55",
    tip: "Correct Score 2-1",
    confidence: 69,
    vip: true,
  },
  {
    id: "p8",
    teamA: "Man City",
    teamB: "Liverpool",
    league: "Premier League",
    kickoff: "16:30",
    day: "sun",
    odds: "1.88",
    tip: "Over 2.5 Goals",
    confidence: 90,
    vip: true,
  },
  {
    id: "p9",
    teamA: "Roma",
    teamB: "Lazio",
    league: "Serie A",
    kickoff: "18:00",
    day: "sun",
    odds: "1.60",
    tip: "Under 3.5 Goals",
    confidence: 78,
    vip: false,
  },
];

const UNLOCK_KEY = "ace:unlocked";
const CUSTOM_KEY = "ace:custom";
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

export function getCustomPredictions(): Prediction[] {
  return read<Prediction[]>(CUSTOM_KEY, []);
}

export function addCustomPrediction(p: Prediction) {
  const next = [p, ...getCustomPredictions()];
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
  return next;
}

/** Lightweight djb2 hash — the raw passcode is never stored in source. */
export function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = ((h << 5) + h + pin.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** Hash of the admin passcode. */
export const ADMIN_PIN_HASH = hashPin("Td63hdYEND8ne7394h47f");

/**
 * Rewarded ad hook. On native this wires to Google AdMob's rewarded ad
 * callback; on web we simulate the ad countdown and resolve on completion.
 */
export function showRewardedAd(onTick: (secondsLeft: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    let left = 5;
    onTick(left);
    const timer = setInterval(() => {
      left -= 1;
      onTick(left);
      if (left <= 0) {
        clearInterval(timer);
        resolve(true);
      }
    }, 1000);
  });
}