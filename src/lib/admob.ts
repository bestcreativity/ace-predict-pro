import { AdMob } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";

const REWARDED_AD_UNIT_ID = "ca-app-pub-8152015975128016/6110317582";
/** Google's always-filling rewarded unit, used to prove the SDK wiring works. */
const TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";
const TEST_MODE_KEY = "ace:admob-test";

let initialization: Promise<void> | undefined;

export function canUseNativeAdMob() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AdMob");
}

export function isAdMobTestMode() {
  try {
    return window.localStorage.getItem(TEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdMobTestMode(enabled: boolean) {
  try {
    if (enabled) {
      window.localStorage.setItem(TEST_MODE_KEY, "1");
    } else {
      window.localStorage.removeItem(TEST_MODE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

/** Turns a plugin rejection into something readable enough to diagnose. */
export function describeAdMobError(error: unknown) {
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const details = error as { message?: string; code?: string | number };
    const parts = [details.message, details.code === undefined ? undefined : `code ${details.code}`];
    const text = parts.filter(Boolean).join(" · ");
    if (text) return text;
  }

  return "Unknown AdMob error";
}

function initializeAdMob() {
  if (initialization) return initialization;

  initialization = (async () => {
    await AdMob.initialize();

    // Consent only blocks ad requests where a form is actually required.
    try {
      let consent = await AdMob.requestConsentInfo();
      if (!consent.canRequestAds && consent.isConsentFormAvailable) {
        consent = await AdMob.showConsentForm();
      }
    } catch {
      /* Consent is unavailable outside the EEA; ads can still be requested. */
    }
  })().catch((error) => {
    initialization = undefined;
    throw error;
  });

  return initialization;
}

/**
 * Plays the native AdMob rewarded ad and resolves true only after Google
 * reports that the user earned the configured reward.
 *
 * Returns false when running in Chrome or in an older APK without the native
 * AdMob plugin, allowing the existing web-ad fallback to remain available.
 */
export async function playAdMobRewardedAd(): Promise<boolean> {
  if (!canUseNativeAdMob()) {
    return false;
  }

  const adId = isAdMobTestMode() ? TEST_REWARDED_AD_UNIT_ID : REWARDED_AD_UNIT_ID;

  await initializeAdMob();
  await AdMob.prepareRewardVideoAd({ adId, immersiveMode: true });

  const reward = await AdMob.showRewardVideoAd({ adId });
  return reward.amount >= 1;
}
