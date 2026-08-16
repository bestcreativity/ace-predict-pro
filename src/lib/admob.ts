import { AdMob } from "@capacitor-community/admob";
import { Capacitor } from "@capacitor/core";

const REWARDED_AD_UNIT_ID = "ca-app-pub-8152015975128016/6110317582";

let initialization: Promise<void> | undefined;

export function canUseNativeAdMob() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("AdMob");
}

function initializeAdMob() {
  if (initialization) return initialization;

  initialization = (async () => {
    await AdMob.initialize();

    let consent = await AdMob.requestConsentInfo();
    if (!consent.canRequestAds && consent.isConsentFormAvailable) {
      consent = await AdMob.showConsentForm();
    }

    if (!consent.canRequestAds) {
      throw new Error("Ad consent is required before an ad can be shown.");
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

  await initializeAdMob();
  await AdMob.prepareRewardVideoAd({
    adId: REWARDED_AD_UNIT_ID,
    immersiveMode: true,
  });

  const reward = await AdMob.showRewardVideoAd({ adId: REWARDED_AD_UNIT_ID });
  if (reward.amount < 1) {
    throw new Error("The rewarded ad was not completed.");
  }

  return true;
}
