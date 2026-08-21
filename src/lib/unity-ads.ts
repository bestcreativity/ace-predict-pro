import { registerPlugin, Capacitor } from "@capacitor/core";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UNITY ADS SETUP — fill these two values from your Unity dashboard.
 *   1. Game ID:        Unity dashboard → your project → "Game ID" (numeric)
 *   2. Placement ID:   the Rewarded placement you created for Android
 * ─────────────────────────────────────────────────────────────────────────────
 */
const UNITY_GAME_ID = "REPLACE_WITH_YOUR_UNITY_GAME_ID";
const UNITY_REWARDED_PLACEMENT_ID = "Rewarded_Android";

interface UnityAdsPlugin {
  initialize(options: { gameId: string; testMode: boolean }): Promise<void>;
  loadRewarded(options: { placementId: string }): Promise<void>;
  showRewarded(options: { placementId: string }): Promise<{ rewarded: boolean }>;
}

const UnityAds = registerPlugin<UnityAdsPlugin>("UnityAds");

let initialized = false;

export function canUseUnityAds(): boolean {
  return (
    UNITY_GAME_ID.startsWith("REPLACE_") === false &&
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("UnityAds")
  );
}

export function isUnityAdsConfigured(): boolean {
  return UNITY_GAME_ID.startsWith("REPLACE_") === false;
}

export function describeUnityError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const details = error as { message?: string };
    if (details.message) return details.message;
  }
  return "Unknown Unity Ads error";
}

/**
 * Plays the Unity Ads rewarded video. Resolves true only when the user watched
 * the whole ad and earned the reward. Returns false when running outside the
 * native app (web browser) so the caller can fall back to another ad source.
 */
export async function playUnityRewardedAd(): Promise<boolean> {
  if (!canUseUnityAds()) {
    return false;
  }

  if (!initialized) {
    await UnityAds.initialize({ gameId: UNITY_GAME_ID, testMode: false });
    initialized = true;
  }

  await UnityAds.loadRewarded({ placementId: UNITY_REWARDED_PLACEMENT_ID });
  const result = await UnityAds.showRewarded({ placementId: UNITY_REWARDED_PLACEMENT_ID });
  return result.rewarded;
}
