import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { PredictionCard } from "@/components/ace/PredictionCard";
import { SecretAdminGate } from "@/components/ace/SecretAdminGate";
import { getMatchesByDay, getUnlocked, type DayMatches, type Match } from "@/lib/ace";
import { APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "5 ACE PREDICT — Premium Football Predictions" },
      {
        name: "description",
        content:
          "Premium football predictions: Over 2.5, Half/Full and Highest Scoring Half tips for today and tomorrow. No sign-up required.",
      },
      { property: "og:title", content: "5 ACE PREDICT — Daily Football Predictions" },
      {
        property: "og:description",
        content: "Expert football tips for today and tomorrow. Watch an ad to unlock each pick.",
      },
    ],
  }),
  component: Index,
});

type DayTab = "today" | "tomorrow";

/** Always shows five cards, filling any missing slot with a Coming Soon placeholder. */
function padMatches(matches: Match[], date: string): Match[] {
  const filled: Match[] = [];
  for (let slot = 1; slot <= 5; slot += 1) {
    const existing = matches.find((match) => match.slot === slot);
    filled.push(
      existing ?? {
        id: `${date}-${slot}`,
        matchDate: date,
        slot,
        published: false,
        teamA: "",
        teamB: "",
        league: "",
        kickoff: "",
        tipOver25: "",
        tipHalfFull: "",
        tipHighestHalf: "",
        adZoneId: "",
        adUrl: "",
        updatedAt: "",
      },
    );
  }
  return filled;
}

function Index() {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [days, setDays] = useState<DayMatches | null>(null);
  const [tab, setTab] = useState<DayTab>("today");
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setUnlocked(getUnlocked());
  }, []);

  const refreshMatches = useCallback(async () => {
    try {
      setDays(await getMatchesByDay());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);
  const handleUnlocked = useCallback((id: string) => {
    setUnlocked((current) => [...new Set([...current, id])]);
  }, []);

  useEffect(() => {
    void refreshMatches();
    const timer = window.setInterval(() => void refreshMatches(), 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshMatches();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshMatches]);

  const matches =
    tab === "today"
      ? padMatches(days?.today ?? [], days?.businessToday ?? "")
      : padMatches(days?.tomorrow ?? [], days?.businessTomorrow ?? "");

  return (
    <div className="shell-bg min-h-dvh pb-56">
      <header className="mx-auto w-full max-w-2xl px-3 pt-6 sm:px-4 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-gradient-gold min-w-0 font-display text-[clamp(1.65rem,8vw,2rem)] font-bold tracking-tight">
            5 ACE PREDICT
          </h1>
          <a
            href="https://t.me/dacechannel"
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-neon/12 px-3 py-1.5 text-xs font-semibold text-neon ring-1 ring-neon/40"
          >
            <Send className="size-3.5" /> Join Telegram
          </a>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          We don't gamble, We invest
          <span
            className="ml-2 inline-flex items-center rounded-full bg-gold/10 px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide text-gold ring-1 ring-gold/40"
            title="App version"
          >
            v{APP_VERSION}
          </span>
        </p>
      </header>

      <main className="mx-auto mt-5 w-full max-w-2xl px-3 sm:mt-6 sm:px-4">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Premium Predictions
            </h2>
            <div className="flex rounded-full bg-secondary/60 p-0.5 ring-1 ring-border/60">
              {(["today", "tomorrow"] as const).map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setTab(day)}
                  className={
                    "rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide transition " +
                    (tab === day
                      ? "bg-gold text-background shadow"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {day === "today" ? "Today" : "Tomorrow"}
                </button>
              ))}
            </div>
          </div>
          {loadError ? (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Could not refresh predictions. Showing the latest available matches.
            </p>
          ) : null}
          <div className="space-y-3">
            {matches.map((match) => (
              <PredictionCard
                key={match.id}
                match={match}
                unlocked={unlocked.includes(match.id)}
                onUnlocked={handleUnlocked}
              />
            ))}
          </div>
        </section>
      </main>

      <SecretAdminGate />
    </div>
  );
}
