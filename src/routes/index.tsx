import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { PredictionCard } from "@/components/ace/PredictionCard";
import { SecretAdminGate } from "@/components/ace/SecretAdminGate";
import {
  EMPTY_PREDICTION_SLOTS,
  getPredictionSlots,
  getUnlocked,
  type Prediction,
} from "@/lib/ace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ACE PREDICT — Premium Football Predictions" },
      {
        name: "description",
        content:
          "Premium football predictions with odds, kickoff times and confidence ratings. No sign-up required.",
      },
      { property: "og:title", content: "ACE PREDICT — Daily Football Predictions" },
      {
        property: "og:description",
        content: "Expert football tips with confidence ratings. Watch an ad to unlock each pick.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [slots, setSlots] = useState<Prediction[]>(EMPTY_PREDICTION_SLOTS);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setUnlocked(getUnlocked());
  }, []);

  const refreshSlots = useCallback(async () => {
    try {
      setSlots(await getPredictionSlots());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);
  const handleUnlocked = useCallback((id: string) => {
    setUnlocked((current) => [...new Set([...current, id])]);
  }, []);

  useEffect(() => {
    void refreshSlots();
    const timer = window.setInterval(() => void refreshSlots(), 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshSlots();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshSlots]);

  return (
    <div className="shell-bg min-h-screen pb-56">
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
      </header>

      <main className="mx-auto mt-6 max-w-2xl px-4">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Premium Predictions
            </h2>
            <span className="text-[11px] text-muted-foreground">5 daily slots</span>
          </div>
          {loadError ? (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Could not refresh predictions. Showing the latest available slots.
            </p>
          ) : null}
          <div className="space-y-3">
            {slots.map((prediction) => (
              <PredictionCard
                key={prediction.id}
                prediction={prediction}
                unlocked={unlocked.includes(prediction.id)}
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
