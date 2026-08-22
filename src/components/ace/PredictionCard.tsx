import { CalendarClock, Clock, Sparkles } from "lucide-react";
import type { Match } from "@/lib/ace";

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-display text-sm font-semibold text-neon">{value}</span>
    </div>
  );
}

export function PredictionCard({ match }: { match: Match }) {
  if (!match.published) {
    return (
      <article className="surface-card flex min-h-36 flex-col items-center justify-center gap-2 p-5 text-center">
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

      <div className="mt-3">
        <h3 className="break-words font-display text-base font-semibold leading-tight sm:text-lg">
          {match.teamA} <span className="text-muted-foreground">vs</span> {match.teamB}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> Kickoff {match.kickoff}
        </div>

        <div className="mt-4 space-y-2 rounded-lg bg-secondary/60 px-3 py-2.5">
          <TipRow label="Over/Under 2.5" value={match.tipOver25} />
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
    </article>
  );
}
