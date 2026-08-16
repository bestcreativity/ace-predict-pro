import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { PredictionCard } from "@/components/ace/PredictionCard";
import { SecretAdminGate } from "@/components/ace/SecretAdminGate";
import {
  BASE_PREDICTIONS,
  DAYS,
  getCustomPredictions,
  getUnlocked,
  type DayKey,
  type Prediction,
} from "@/lib/ace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ACE PREDICT — Daily Football Predictions & VIP Picks" },
      {
        name: "description",
        content:
          "Free and VIP football predictions with odds, kickoff times and confidence ratings. No sign-up required.",
      },
      { property: "og:title", content: "ACE PREDICT — Daily Football Predictions" },
      {
        property: "og:description",
        content: "Expert daily football tips with confidence ratings. Unlock VIP picks instantly.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [day, setDay] = useState<DayKey>("today");
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [custom, setCustom] = useState<Prediction[]>([]);

  useEffect(() => {
    setUnlocked(getUnlocked());
    setCustom(getCustomPredictions());
  }, []);

  const all = useMemo(() => [...custom, ...BASE_PREDICTIONS], [custom]);
  const list = all.filter((p) => p.day === day);
  const free = list.filter((p) => !p.vip);
  const vip = list.filter((p) => p.vip);

  return (
    <div className="shell-bg min-h-screen pb-20">
      <header className="mx-auto max-w-2xl px-4 pt-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-gradient-gold font-display text-3xl font-bold tracking-tight">
            ACE PREDICT
          </h1>
          <span className="flex items-center gap-1.5 rounded-full bg-neon/12 px-3 py-1.5 text-xs font-semibold text-neon ring-1 ring-neon/40">
            <TrendingUp className="size-3.5" /> Weekly Accuracy: 84%
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Sharp daily picks. No account, no sign-up.
        </p>

        <nav className="mt-5 flex gap-2 overflow-x-auto rounded-xl bg-secondary/50 p-1.5">
          {DAYS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDay(d.key)}
              className={
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                (day === d.key
                  ? "bg-[image:var(--gradient-gold)] text-gold-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {d.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto mt-6 max-w-2xl space-y-6 px-4">
        <Section title="Free Predictions" items={free} unlocked={unlocked} setUnlocked={setUnlocked} />
        <Section title="VIP Predictions" items={vip} unlocked={unlocked} setUnlocked={setUnlocked} />
      </main>

      <SecretAdminGate />
    </div>
  );
}

function Section({
  title,
  items,
  unlocked,
  setUnlocked,
}: {
  title: string;
  items: Prediction[];
  unlocked: string[];
  setUnlocked: (v: string[]) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="surface-card p-4 text-sm text-muted-foreground">No matches listed yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <PredictionCard
              key={p.id}
              prediction={p}
              unlocked={unlocked.includes(p.id)}
              onUnlocked={(id) => setUnlocked([...unlocked, id])}
            />
          ))}
        </div>
      )}
    </section>
  );
}
