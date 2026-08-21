import { useEffect, useState } from "react";
import { CalendarClock, Clock, Lock, PlayCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unlock, type Match } from "@/lib/ace";
import { canUseUnityAds, describeUnityError, playUnityRewardedAd } from "@/lib/unity-ads";
import { playRewardedAd } from "@/lib/rewarded-ad";

const PENDING_AD_KEY = "ace:pending-ad";

// Monetag is paused. Flip to true to re-enable it as a fallback ad source.
const MONETAG_ENABLED = false;

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-display text-sm font-semibold text-neon">{value}</span>
    </div>
  );
}

export function PredictionCard({
  match,
  unlocked,
  onUnlocked,
}: {
  match: Match;
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
        if (pending.id !== match.id || Date.now() - pending.openedAt < 750) return;
        window.localStorage.removeItem(PENDING_AD_KEY);
        unlock(match.id);
        onUnlocked(match.id);
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
  }, [onUnlocked, match.id]);

  function openAdLink() {
    if (!match.adUrl) {
      toast.error("This pick has no ad configured yet.");
      return;
    }

    setOpeningAd(true);
    window.localStorage.setItem(
      PENDING_AD_KEY,
      JSON.stringify({ id: match.id, openedAt: Date.now() }),
    );

    const adWindow = window.open(match.adUrl, "_blank");
    if (adWindow) {
      adWindow.opener = null;
    } else {
      window.location.assign(match.adUrl);
    }
  }

  function completeUnlock() {
    unlock(match.id);
    onUnlocked(match.id);
  }

  async function watchAd() {
    if (openingAd || playingAd) return;
    setPlayingAd(true);

    try {
      // 1. Unity Ads rewarded video (native, inside the APK).
      if (canUseUnityAds()) {
        try {
          if (await playUnityRewardedAd()) {
            completeUnlock();
            return;
          }
          toast.error("Watch the full video ad to unlock this pick.");
          return;
        } catch (error) {
          toast.error(`Unity Ads: ${describeUnityError(error)}`);
        }
      }

      // 2. Monetag rewarded ad (PAUSED — set MONETAG_ENABLED to true to re-enable).
      if (MONETAG_ENABLED && match.adZoneId) {
        try {
          await playRewardedAd(match.adZoneId);
          completeUnlock();
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Rewarded ad failed";
          toast.error(message);
        }
      }

      // 3. Direct ad link (last resort).
      openAdLink();
    } finally {
      setPlayingAd(false);
    }
  }

  if (!match.published) {
    return (
      <article className="surface-card flex min-h-44 flex-col items-center justify-center gap-3 p-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30">
          <CalendarClock className="size-6 text-gold" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Match {match.slot}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold">Game Coming Soon</h3>
          <p className="mt-1 text-xs text-muted-foreground">A new premium pick will appear here.</p>
        </div>
      </article>
    );
  }

  return (
    <article className="surface-card relative min-w-0 overflow-hidden p-3.5 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.9)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:tracking-[0.14em]">
          <span>{match.league}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/40">
          <Sparkles className="size-3" /> PREMIUM
        </span>
      </div>

      <div className={locked ? "mt-3 select-none blur-[7px]" : "mt-3"}>
        <h3 className="break-words font-display text-base font-semibold leading-tight sm:text-lg">
          {match.teamA} <span className="text-muted-foreground">vs</span> {match.teamB}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Kickoff {match.kickoff}
        </div>

        <div className="mt-4 space-y-2 rounded-lg bg-secondary/60 px-3 py-2.5">
          <TipRow label="Over/Under 2.5" value={match.tipOver25} />
          <TipRow label="HT / FT" value={match.tipHalfFull} />
          <TipRow label="Highest Scoring Half" value={match.tipHighestHalf} />
        </div>

        {match.slipImage ? (
          <img
            src={match.slipImage}
            alt={`Betting slip for ${match.teamA} vs ${match.teamB}`}
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
          <Button
            variant="hero"
            size="sm"
            className="h-auto max-w-full whitespace-normal py-2 text-center leading-tight"
            onClick={watchAd}
            disabled={openingAd || playingAd}
          >
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
