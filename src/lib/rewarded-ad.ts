type RewardedAdFn = (options?: Record<string, unknown>) => Promise<unknown>;

const SDK_SRC = "https://libtl.com/sdk.js";
const pendingLoads = new Map<string, Promise<RewardedAdFn>>();

function rewardedFnName(zoneId: string) {
  return `show_${zoneId}`;
}

function readRewardedFn(zoneId: string): RewardedAdFn | undefined {
  return (window as unknown as Record<string, RewardedAdFn | undefined>)[rewardedFnName(zoneId)];
}

/**
 * The SDK defines `show_<zoneId>` asynchronously after its script executes, so
 * the loader keeps polling for a short while before giving up.
 */
export function loadRewardedAd(zoneId: string): Promise<RewardedAdFn> {
  const existing = readRewardedFn(zoneId);
  if (existing) return Promise.resolve(existing);

  const inFlight = pendingLoads.get(zoneId);
  if (inFlight) return inFlight;

  const load = new Promise<RewardedAdFn>((resolve, reject) => {
    const waitForFn = (attemptsLeft: number) => {
      const fn = readRewardedFn(zoneId);
      if (fn) {
        resolve(fn);
        return;
      }
      if (attemptsLeft <= 0) {
        reject(new Error("Rewarded ad is unavailable"));
        return;
      }
      window.setTimeout(() => waitForFn(attemptsLeft - 1), 200);
    };

    if (document.querySelector(`script[data-zone="${zoneId}"]`)) {
      waitForFn(50);
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.dataset["zone"] = zoneId;
    script.dataset["sdk"] = rewardedFnName(zoneId);
    script.onload = () => waitForFn(50);
    script.onerror = () => reject(new Error("Rewarded ad failed to load"));
    document.head.appendChild(script);
  });

  load.catch(() => pendingLoads.delete(zoneId));
  pendingLoads.set(zoneId, load);
  return load;
}

/** Resolves only once the viewer has earned the reward. */
export async function playRewardedAd(zoneId: string): Promise<void> {
  const show = await loadRewardedAd(zoneId);
  await show();
}
