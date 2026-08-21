import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, ImagePlus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ADMIN_SESSION_KEY,
  EMPTY_PREDICTION_SLOTS,
  getPredictionSlots,
  savePredictionSlot,
  type Prediction,
  type PredictionSlotInput,
} from "@/lib/ace";
import { canUseUnityAds, isUnityAdsConfigured } from "@/lib/unity-ads";
import { WeeklyTracker } from "@/components/ace/WeeklyTracker";
import { APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Manage Predictions — ACE PREDICT Admin" },
      { name: "description", content: "Internal admin console for managing ACE PREDICT slots." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState("");
  const [slots, setSlots] = useState<Prediction[]>(EMPTY_PREDICTION_SLOTS);
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [slip, setSlip] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedPasscode = window.sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!storedPasscode || storedPasscode === "1") {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
      navigate({ to: "/" });
      return;
    }

    setPasscode(storedPasscode);
    getPredictionSlots()
      .then((loadedSlots) => {
        setSlots(loadedSlots);
        setSlip(loadedSlots[0]?.slipImage);
      })
      .catch(() => toast.error("Could not load prediction slots"));
  }, [navigate]);

  const selected = slots.find((slot) => slot.slot === selectedSlot) ?? EMPTY_PREDICTION_SLOTS[0]!;

  function selectSlot(slot: Prediction) {
    setSelectedSlot(slot.slot);
    setSlip(slot.slipImage);
  }

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      toast.error("Image must be smaller than 1.5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSlip(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function persist(input: PredictionSlotInput, message: string) {
    setSaving(true);
    try {
      const saved = await savePredictionSlot(passcode, input);
      setSlots((current) => current.map((slot) => (slot.slot === saved.slot ? saved : slot)));
      setSlip(saved.slipImage);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save this slot";
      toast.error(message.includes("Invalid admin passcode") ? "Admin session expired" : message);
    } finally {
      setSaving(false);
    }
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await persist(
      {
        slot: selectedSlot,
        published: true,
        teamA: String(form.get("teamA")),
        teamB: String(form.get("teamB")),
        league: String(form.get("league")),
        kickoff: String(form.get("kickoff")),
        odds: String(form.get("odds")),
        tip: String(form.get("tip")),
        confidence: Number(form.get("confidence")) || 80,
        adZoneId: String(form.get("adZoneId") ?? "").trim(),
        adUrl: String(form.get("adUrl") ?? "").trim(),
        ...(slip ? { slipImage: slip } : {}),
      },
      `Prediction ${selectedSlot} published`,
    );
  }

  async function clearSlot() {
    await persist(
      {
        slot: selectedSlot,
        published: false,
        teamA: "",
        teamB: "",
        league: "",
        kickoff: "",
        odds: "",
        tip: "",
        confidence: 80,
        adZoneId: "",
        adUrl: "",
      },
      `Prediction ${selectedSlot} changed to Coming Soon`,
    );
  }

  if (!passcode) return null;

  return (
    <div className="shell-bg min-h-dvh pb-20">
      <header className="mx-auto flex w-full max-w-2xl items-start gap-2 px-3 pt-6 sm:items-center sm:gap-3 sm:px-4 sm:pt-8">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-gradient-gold break-words font-display text-xl font-bold sm:text-2xl">Manage Predictions</h1>
          <p className="text-xs text-muted-foreground">
            Choose and update any of the five live cards.
            <span className="ml-1.5 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold ring-1 ring-gold/40">
              v{APP_VERSION}
            </span>
          </p>
        </div>
      </header>

      <main className="mx-auto mt-5 w-full max-w-2xl space-y-4 px-3 sm:mt-6 sm:px-4">
        <UnityAdsStatus />

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {slots.map((slot) => (
            <button
              key={slot.slot}
              type="button"
              onClick={() => selectSlot(slot)}
              className={
                "surface-card min-h-24 p-3 text-left transition " +
                (selectedSlot === slot.slot ? "ring-2 ring-gold" : "hover:border-gold/40")
              }
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Card {slot.slot}
              </span>
              <span className="mt-2 block text-xs font-semibold">
                {slot.published ? `${slot.teamA} vs ${slot.teamB}` : "Coming Soon"}
              </span>
              <span className={slot.published ? "mt-1 block text-[10px] text-neon" : "mt-1 block text-[10px] text-gold"}>
                {slot.published ? "Published" : "Empty"}
              </span>
            </button>
          ))}
        </section>

        <form
          key={`${selected.slot}-${selected.updatedAt}`}
          onSubmit={publish}
          className="surface-card min-w-0 space-y-5 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Editing</p>
              <h2 className="font-display text-xl font-semibold">Prediction {selectedSlot}</h2>
            </div>
            {!selected.published ? (
              <span className="flex items-center gap-1 rounded-full bg-gold/10 px-3 py-1 text-xs text-gold">
                <CalendarClock className="size-3.5" /> Coming Soon
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="teamA" label="Team A" defaultValue={selected.teamA} placeholder="Arsenal" />
            <Field name="teamB" label="Team B" defaultValue={selected.teamB} placeholder="Chelsea" />
            <Field
              name="league"
              label="League Name"
              defaultValue={selected.league}
              placeholder="Premier League"
            />
            <Field name="kickoff" label="Match Time" defaultValue={selected.kickoff} placeholder="17:30" />
            <Field name="odds" label="Odds" defaultValue={selected.odds} placeholder="1.80" />
            <Field name="tip" label="Prediction" defaultValue={selected.tip} placeholder="Home Win" />
            <Field
              name="confidence"
              label="Confidence Level (%)"
              defaultValue={String(selected.confidence)}
              placeholder="85"
              type="number"
              min="1"
              max="100"
            />
          </div>

          <div className="space-y-4 rounded-lg border border-border/60 bg-secondary/30 p-4">
            <div>
              <h3 className="text-sm font-semibold">Ad Unlock</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                A Zone ID plays a real rewarded video inside the app. A direct link only opens a
                webpage, so it is used as a fallback when the video cannot load.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="adZoneId"
                label="Monetag Rewarded Zone ID"
                defaultValue={selected.adZoneId}
                placeholder="9876543"
                inputMode="numeric"
                required={false}
              />
              <Field
                name="adUrl"
                label="Direct Ad Link (fallback)"
                defaultValue={selected.adUrl}
                placeholder="https://example.com/your-ad"
                type="url"
                required={false}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> {slip ? "Replace Betting Slip" : "Upload Betting Slip"}
            </Button>
            {slip ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSlip(undefined)}>
                Remove image
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickImage}
            />
          </div>

          {slip ? (
            <img src={slip} alt="Betting slip preview" className="max-h-56 w-full rounded-lg object-contain" />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="submit" variant="hero" disabled={saving}>
              <Save className="size-4" /> {saving ? "SAVING…" : "PUBLISH THIS CARD"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving || !selected.published}
              onClick={clearSlot}
            >
              <Trash2 className="size-4" /> SET TO COMING SOON
            </Button>
          </div>
        </form>

        <WeeklyTracker passcode={passcode} />
      </main>
    </div>
  );
}

function UnityAdsStatus() {
  const configured = isUnityAdsConfigured();
  const available = canUseUnityAds();

  return (
    <section className="surface-card space-y-2 p-4">
      <h2 className="text-sm font-semibold">Unity Ads Rewarded Video</h2>
      <p className="text-xs text-muted-foreground">
        {!configured
          ? "Unity Ads is not configured yet — add your Game ID in src/lib/unity-ads.ts."
          : available
            ? "Unity Ads is active in this app build."
            : "Unity Ads is configured but unavailable here — open the installed app to use it."}
      </p>
    </section>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  type = "text",
  min,
  max,
  inputMode,
  required = true,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  type?: string;
  min?: string;
  max?: string;
  inputMode?: "numeric";
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        type={type}
        min={min}
        max={max}
        inputMode={inputMode}
        required={required}
      />
    </div>
  );
}
