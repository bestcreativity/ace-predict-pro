import { useEffect, useState } from "react";
import { CalendarClock, Clock, Lock, PlayCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unlock, type Prediction } from "@/lib/ace";
import { canUseNativeAdMob, playAdMobRewardedAd } from "@/lib/admob";
import { playRewardedAd } from "@/lib/rewarded-ad";

const PENDING_AD_KEY = "ace:pending-ad";

function ConfidenceBadge({ value }: { value: number }) {
  const strong = value >= 80;
  return (
    <span
      className={
        "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide " +
        (strong
          ? "bg-neon/15 text-neon ring-1 ring-neon/40"
          : "bg-muted text-muted-foreground ring-1 ring-border")
      }
    >
      {value}% CONFIDENCE
    </span>
  );
}

export function PredictionCard({
  prediction,
  unlocked,
  onUnlocked,
}: {
  prediction: Prediction;
  unlocked: boolean;
  onUnlocked: (id: string) => void;
}) {
  const [openingAd, setOpeningAd] = useState(false);
  const [playingAd, setPlayingAd] = useState(false);
  const locked = !unlocked;

  useEffect(() => {
    function completePendingAd() {
      try {
        const raw = window.localStorage.getItem(PENDING_AD_KEY);
        if (!raw) return;
        const pending = JSON.parse(raw) as { id: string; openedAt: number };
        if (pending.id !== prediction.id || Date.now() - pending.openedAt < 750) return;
        window.localStorage.removeItem(PENDING_AD_KEY);
        unlock(prediction.id);
        onUnlocked(prediction.id);
        setOpeningAd(false);
      } catch {
        window.localStorage.removeItem(PENDING_AD_KEY);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") completePendingAd();
    }

    completePendingAd();
    window.addEventListener("focus", completePendingAd);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", completePendingAd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [onUnlocked, prediction.id]);

  function openAdLink() {
    if (!prediction.adUrl) {
      toast.error("This pick has no ad configured yet.");
      return;
    }

    setOpeningAd(true);
    window.localStorage.setItem(
      PENDING_AD_KEY,
      JSON.stringify({ id: prediction.id, openedAt: Date.now() }),
    );

    const adWindow = window.open(prediction.adUrl, "_blank");
    if (adWindow) {
      adWindow.opener = null;
    } else {
      window.location.assign(prediction.adUrl);
    }
  }

  async function watchAd() {
    if (openingAd || playingAd) return;

    setPlayingAd(true);
    const nativeAdMob = canUseNativeAdMob();

    try {
      if (nativeAdMob && (await playAdMobRewardedAd())) {
        unlock(prediction.id);
        onUnlocked(prediction.id);
        return;
      }

      if (prediction.adZoneId) {
        await playRewardedAd(prediction.adZoneId);
        unlock(prediction.id);
        onUnlocked(prediction.id);
        return;
      }

      openAdLink();
    } catch {
      if (nativeAdMob) {
        toast.error("Video ad unavailable. Please try again shortly.");
      } else {
        openAdLink();
      }
    } finally {
      setPlayingAd(false);
    }
  }

  if (!prediction.published) {
    return (
      <article className="surface-card flex min-h-44 flex-col items-center justify-center gap-3 p-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30">
          <CalendarClock className="size-6 text-gold" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Prediction {prediction.slot}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold">Game Coming Soon</h3>
          <p className="mt-1 text-xs text-muted-foreground">A new premium pick will appear here.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-card relative overflow-hidden p-4 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>{prediction.league}</span>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/40">
          <Sparkles className="size-3" /> PREMIUM
        </span>
      </div>

      <div className={locked ? "mt-3 select-none blur-[7px]" : "mt-3"}>
        <h3 className="font-display text-lg font-semibold leading-tight">
          {prediction.teamA} <span className="text-muted-foreground">vs</span> {prediction.teamB}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Kickoff {prediction.kickoff}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/60 px-3 py-2.5">
          <span className="font-display text-sm font-semibold text-neon">
            {prediction.tip} @ {prediction.odds}
          </span>
          <ConfidenceBadge value={prediction.confidence} />
        </div>

        {prediction.slipImage ? (
          <img
            src={prediction.slipImage}
            alt={`Betting slip for ${prediction.teamA} vs ${prediction.teamB}`}
            loading="lazy"
            className="mt-3 max-h-44 w-full rounded-lg object-cover"
          />
        ) : null}
      </div>

      {locked ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/55 px-4 text-center backdrop-blur-[2px]">
          <div className="flex size-11 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/50">
            <Lock className="size-5 text-gold" />
          </div>
          <p className="text-xs text-muted-foreground">Premium pick locked</p>
          <Button variant="hero" size="sm" onClick={watchAd} disabled={openingAd || playingAd}>
            <PlayCircle className="size-4" />
            {playingAd
              ? "LOADING AD…"
              : openingAd
                ? "RETURN AFTER WATCHING"
                : "WATCH AD TO UNLOCK PICK"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}