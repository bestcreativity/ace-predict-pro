import { useState } from "react";
import { Lock, PlayCircle, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showRewardedAd, unlock, type Prediction } from "@/lib/ace";

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
  const [countdown, setCountdown] = useState<number | null>(null);
  const locked = prediction.vip && !unlocked;

  async function watchAd() {
    if (countdown !== null) return;
    await showRewardedAd((s) => setCountdown(s));
    setCountdown(null);
    unlock(prediction.id);
    onUnlocked(prediction.id);
  }

  return (
    <article className="surface-card relative overflow-hidden p-4 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>{prediction.league}</span>
        </div>
        {prediction.vip ? (
          <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold ring-1 ring-gold/40">
            <Sparkles className="size-3" /> VIP
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            FREE
          </span>
        )}
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
          <Button variant="hero" size="sm" onClick={watchAd} disabled={countdown !== null}>
            <PlayCircle className="size-4" />
            {countdown !== null ? `AD PLAYING… ${countdown}s` : "WATCH AD TO UNLOCK PICK"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}