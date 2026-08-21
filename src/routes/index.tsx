import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { PredictionCard } from "@/components/ace/PredictionCard";
import { SecretAdminGate } from "@/components/ace/SecretAdminGate";
import {
  EMPTY_PREDICTION_SLOTS,
  getPredictionSlots,
  getUnlocked,
  type Prediction,
} from "@/lib/ace";
import { APP_VERSION } from "@/lib/version";

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
    <div className="shell-bg min-h-dvh pb-56">
      <header className="mx-auto w-full max-w-2xl px-3 pt-6 sm:px-4 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-gradient-gold min-w-0 font-display text-[clamp(1.65rem,8vw,2rem)] font-bold tracking-tight">
            ACE PREDICT
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
