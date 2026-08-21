package com.acepredict.app;

import android.app.Activity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;

/**
 * Minimal Capacitor bridge around the Unity Ads SDK, exposing only what the
 * web app needs for rewarded video: initialize, load, and show.
 */
@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {

    @PluginMethod
    public void initialize(PluginCall call) {
        String gameId = call.getString("gameId");
        boolean testMode = call.getBoolean("testMode", false);

        if (gameId == null || gameId.isEmpty()) {
            call.reject("gameId is required");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity available");
            return;
        }

        UnityAds.initialize(
            activity,
            gameId,
            new IUnityAdsInitializationListener() {
                @Override
                public void onInitializationComplete() {
                    call.resolve();
                }

                @Override
                public void onInitializationFailed(
                    UnityAds.UnityAdsInitializationError error,
                    String message
                ) {
                    call.reject("Unity Ads init failed: " + message);
                }
            },
            testMode
        );
    }

    @PluginMethod
    public void loadRewarded(PluginCall call) {
        String placementId = call.getString("placementId");
        if (placementId == null || placementId.isEmpty()) {
            call.reject("placementId is required");
            return;
        }

        UnityAds.load(
            placementId,
            new IUnityAdsLoadListener() {
                @Override
                public void onUnityAdsAdLoaded(String loadedPlacementId) {
                    call.resolve();
                }

                @Override
                public void onUnityAdsFailedToLoad(
                    String loadedPlacementId,
                    UnityAds.UnityAdsLoadError error,
                    String message
                ) {
                    call.reject("Unity Ads load failed: " + message);
                }
            }
        );
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String placementId = call.getString("placementId");
        if (placementId == null || placementId.isEmpty()) {
            call.reject("placementId is required");
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity available");
            return;
        }

        UnityAds.show(
            activity,
            placementId,
            new UnityAdsShowOptions(),
            new IUnityAdsShowListener() {
                @Override
                public void onUnityAdsShowStart(String shownPlacementId) {
                    // Ad started playing; nothing to report yet.
                }

                @Override
                public void onUnityAdsShowClick(String shownPlacementId) {
                    // User clicked the ad; the reward is still granted on completion.
                }

                @Override
                public void onUnityAdsShowComplete(
                    String shownPlacementId,
                    UnityAds.UnityAdsShowCompletionState state
                ) {
                    JSObject result = new JSObject();
                    boolean rewarded = state == UnityAds.UnityAdsShowCompletionState.COMPLETED;
                    result.put("rewarded", rewarded);
                    call.resolve(result);
                }

                @Override
                public void onUnityAdsShowFailure(
                    String shownPlacementId,
                    UnityAds.UnityAdsShowError error,
                    String message
                ) {
                    call.reject("Unity Ads show failed: " + message);
                }
            }
        );
    }
}
