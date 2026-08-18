import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, Trophy, TrendingDown, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  type GameHistoryEntry,
  type GameResult,
  getGameHistory,
  setGameResult,
} from "@/lib/ace";

type WeeklyTrackerProps = {
  passcode: string;
};

export function WeeklyTracker({ passcode }: WeeklyTrackerProps) {
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGameHistory(7);
      if (isMounted.current) setHistory(data);
    } catch {
      toast.error("Could not load game history");
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markResult = useCallback(
    async (entry: GameHistoryEntry, newResult: GameResult) => {
      const key = `${entry.gameDate}-${entry.slot}`;
      const previous = entry.result;

      // Optimistic update — change UI instantly
      setHistory((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, result: newResult } : e)),
      );
      setSavingMap((m) => ({ ...m, [key]: true }));

      try {
        await setGameResult(passcode, entry.gameDate, entry.slot, newResult);
      } catch {
        // Roll back on failure
        setHistory((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, result: previous } : e)),
        );
        toast.error("Could not update result — try again");
      } finally {
        if (isMounted.current) {
          setSavingMap((m) => ({ ...m, [key]: false }));
        }
      }
    },
    [passcode],
  );

  const stats = useMemo(() => {
    const wins = history.filter((g) => g.result === "win").length;
    const losses = history.filter((g) => g.result === "loss").length;
    const pending = history.filter((g) => g.result === "pending").length;
    const decided = wins + losses;
    const rate = decided > 0 ? Math.round((wins / decided) * 100) : 0;
    return { wins, losses, pending, rate, total: history.length };
  }, [history]);

  const grouped = useMemo(() => {
    const map = new Map<string, GameHistoryEntry[]>();
    for (const entry of history) {
      const list = map.get(entry.gameDate) ?? [];
      list.push(entry);
      map.set(entry.gameDate, list);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime(),
    );
  }, [history]);

  if (loading) return <TrackerSkeleton />;

  if (history.length === 0) {
    return (
      <section className="surface-card space-y-2 p-4">
        <h2 className="text-sm font-semibold">Weekly Tracker</h2>
        <p className="text-xs text-muted-foreground">
          No game history yet. Archived games will appear here after the nightly
          clear (23:00 WAT).
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="surface-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">Weekly Performance</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <StatBox label="Total" value={stats.total} />
          <StatBox label="Wins" value={stats.wins} accent="text-neon" />
          <StatBox label="Losses" value={stats.losses} accent="text-destructive" />
          <StatBox label="Win %" value={`${stats.rate}%`} accent="text-gold" />
        </div>
      </div>

      {grouped.map(([date, entries]) => (
        <DayGroup
          key={date}
          date={date}
          entries={entries}
          savingMap={savingMap}
          onMarkResult={markResult}
        />
      ))}
    </section>
  );
}

/* ── DayGroup ────────────────────────────────────────────────────────────── */

const DayGroup = React.memo(function DayGroup({
  date,
  entries,
  savingMap,
  onMarkResult,
}: {
  date: string;
  entries: GameHistoryEntry[];
  savingMap: Record<string, boolean>;
  onMarkResult: (entry: GameHistoryEntry, result: GameResult) => void;
}) {
  const [open, setOpen] = useState(true);

  const dayWins = entries.filter((e) => e.result === "win").length;
  const dayLosses = entries.filter((e) => e.result === "loss").length;
  const dayPending = entries.filter((e) => e.result === "pending").length;

  const formatted = useMemo(
    () =>
      new Date(date + "T12:00:00").toLocaleDateString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [date],
  );

  return (
    <div className="surface-card overflow-hidden p-4">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{formatted}</h3>
          <p className="text-[11px] text-muted-foreground">
            {entries.length} game{entries.length !== 1 ? "s" : ""}
            {dayPending > 0 && (
              <span className="ml-1.5 text-gold">{dayPending} pending</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {dayWins > 0 && (
              <span className="flex items-center gap-0.5 text-neon">
                <Trophy className="size-3" />
                {dayWins}
              </span>
            )}
            {dayLosses > 0 && (
              <span className="flex items-center gap-0.5 text-destructive">
                <TrendingDown className="size-3" />
                {dayLosses}
              </span>
            )}
          </div>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform duration-200 ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {/* Collapsible body */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "mt-3 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-1.5">
            {entries.map((entry) => {
              const key = `${entry.gameDate}-${entry.slot}`;
              return (
                <GameRow
                  key={entry.id}
                  entry={entry}
                  saving={!!savingMap[key]}
                  onMarkResult={(result) => onMarkResult(entry, result)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ── GameRow ─────────────────────────────────────────────────────────────── */

const GameRow = React.memo(function GameRow({
  entry,
  saving,
  onMarkResult,
}: {
  entry: GameHistoryEntry;
  saving: boolean;
  onMarkResult: (result: GameResult) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 transition-colors duration-150">
      {/* Match info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          {entry.teamA} vs {entry.teamB}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {entry.league} &middot; {entry.tip} &middot; {entry.odds}
        </p>
      </div>

      {/* Result badge + actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        <ResultBadge result={entry.result} />

        {entry.result === "pending" && (
          <div className="flex gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-neon transition-colors hover:bg-neon/10 hover:text-neon active:scale-95"
              disabled={saving}
              onClick={() => onMarkResult("win")}
              aria-label="Mark as win"
            >
              <CheckCircle2 className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
              disabled={saving}
              onClick={() => onMarkResult("loss")}
              aria-label="Mark as loss"
            >
              <XCircle className="size-3.5" />
            </Button>
          </div>
        )}

        {entry.result !== "pending" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
            disabled={saving}
            onClick={() => onMarkResult("pending")}
            aria-label="Reset to pending"
          >
            <Clock className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
});

/* ── ResultBadge ─────────────────────────────────────────────────────────── */

const resultStyles: Record<GameResult, string> = {
  win: "bg-neon/10 text-neon",
  loss: "bg-destructive/10 text-destructive",
  pending: "bg-gold/10 text-gold",
};

const resultIcons: Record<GameResult, React.ReactNode> = {
  win: <CheckCircle2 className="size-3" />,
  loss: <XCircle className="size-3" />,
  pending: <Clock className="size-3" />,
};

function ResultBadge({ result }: { result: GameResult }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all duration-200 ${resultStyles[result]}`}
    >
      {resultIcons[result]} {result.toUpperCase()}
    </span>
  );
}

/* ── StatBox ─────────────────────────────────────────────────────────────── */

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 px-2 py-2">
      <p
        className={`text-lg font-bold tabular-nums transition-all duration-200 ${accent ?? ""}`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/* ── Skeleton loader ─────────────────────────────────────────────────────── */

function TrackerSkeleton() {
  return (
    <section className="space-y-3">
      {/* Stats skeleton */}
      <div className="surface-card space-y-3 p-4">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border/40 bg-secondary/30 px-2 py-2"
            >
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-2.5 w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Day group skeletons */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="surface-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"
              >
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
