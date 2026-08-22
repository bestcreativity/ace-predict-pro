import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, ImagePlus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ADMIN_SESSION_KEY,
  getMatchesByDay,
  saveMatch,
  type DayMatches,
  type Match,
  type MatchInput,
} from "@/lib/ace";
import { canUseUnityAds, isUnityAdsConfigured } from "@/lib/unity-ads";
import { WeeklyTracker } from "@/components/ace/WeeklyTracker";
import { APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Manage Predictions — 5 ACE PREDICT Admin" },
      { name: "description", content: "Internal admin console for managing 5 ACE PREDICT matches." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type DayTab = "today" | "tomorrow";

/** Always renders five cards, filling any missing slot with a Coming Soon placeholder. */
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

function AdminPage() {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState("");
  const [days, setDays] = useState<DayMatches | null>(null);
  const [day, setDay] = useState<DayTab>("today");
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
    getMatchesByDay()
      .then((loaded) => {
        setDays(loaded);
        setSlip(padMatches(loaded.today, loaded.businessToday)[0]?.slipImage);
      })
      .catch(() => toast.error("Could not load matches"));
  }, [navigate]);

  const matchDate = day === "today" ? (days?.businessToday ?? "") : (days?.businessTomorrow ?? "");
  const matches = padMatches(day === "today" ? (days?.today ?? []) : (days?.tomorrow ?? []), matchDate);
  const selected = matches.find((match) => match.slot === selectedSlot) ?? matches[0]!;

  function selectMatch(match: Match) {
    setSelectedSlot(match.slot);
    setSlip(match.slipImage);
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

  async function persist(input: MatchInput, message: string) {
    setSaving(true);
    try {
      const saved = await saveMatch(passcode, input);
      setDays((current) => {
        if (!current) return current;
        const bucket = saved.matchDate === current.businessToday ? "today" : "tomorrow";
        const list = current[bucket];
        const next = list.some((match) => match.slot === saved.slot)
          ? list.map((match) => (match.slot === saved.slot ? saved : match))
          : [...list, saved];
        return { ...current, [bucket]: next };
      });
      setSlip(saved.slipImage);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save this match";
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
        matchDate,
        slot: selectedSlot,
        published: true,
        teamA: String(form.get("teamA")),
        teamB: String(form.get("teamB")),
        league: String(form.get("league")),
        kickoff: String(form.get("kickoff")),
        tipOver25: String(form.get("tipOver25")),
        tipHalfFull: String(form.get("tipHalfFull")),
        tipHighestHalf: String(form.get("tipHighestHalf")),
        adZoneId: String(form.get("adZoneId") ?? "").trim(),
        adUrl: String(form.get("adUrl") ?? "").trim(),
        ...(slip ? { slipImage: slip } : {}),
      },
      `Match ${selectedSlot} for ${matchDate} published`,
    );
  }

  async function clearMatch() {
    await persist(
      {
        matchDate,
        slot: selectedSlot,
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
      },
      `Match ${selectedSlot} for ${matchDate} changed to Coming Soon`,
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
            Choose a day, then update any of its five matches.
            <span className="ml-1.5 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold ring-1 ring-gold/40">
              v{APP_VERSION}
            </span>
          </p>
        </div>
      </header>

      <main className="mx-auto mt-5 w-full max-w-2xl space-y-4 px-3 sm:mt-6 sm:px-4">
        <UnityAdsStatus />

        <section className="flex items-center justify-between gap-3">
          <div className="flex rounded-full bg-secondary/60 p-0.5 ring-1 ring-border/60">
            {(["today", "tomorrow"] as const).map((option) => {
              const label = option === "today" ? days?.businessToday : days?.businessTomorrow;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setDay(option);
                    setSlip(undefined);
                  }}
                  className={
                    "rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide transition " +
                    (day === option
                      ? "bg-gold text-background shadow"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {option === "today" ? "Today" : "Tomorrow"}
                  {label ? <span className="ml-1.5 font-normal normal-case opacity-80">{label}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {matches.map((match) => (
            <button
              key={match.slot}
              type="button"
              onClick={() => selectMatch(match)}
              className={
                "surface-card min-h-24 p-3 text-left transition " +
                (selectedSlot === match.slot ? "ring-2 ring-gold" : "hover:border-gold/40")
              }
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Match {match.slot}
              </span>
              <span className="mt-2 block text-xs font-semibold">
                {match.published ? `${match.teamA} vs ${match.teamB}` : "Coming Soon"}
              </span>
              <span className={match.published ? "mt-1 block text-[10px] text-neon" : "mt-1 block text-[10px] text-gold"}>
                {match.published ? "Published" : "Empty"}
              </span>
            </button>
          ))}
        </section>

        <form
          key={`${selected.id}-${selected.updatedAt}`}
          onSubmit={publish}
          className="surface-card min-w-0 space-y-5 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Editing</p>
              <h2 className="font-display text-xl font-semibold">
                {day === "today" ? "Today" : "Tomorrow"} · Match {selectedSlot}
              </h2>
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
            <Field
              name="tipOver25"
              label="Tip — Over/Under 2.5"
              defaultValue={selected.tipOver25}
              placeholder="Over 2.5"
            />
            <Field
              name="tipHalfFull"
              label="Tip — Half/Full"
              defaultValue={selected.tipHalfFull}
              placeholder="Home/Home"
            />
            <Field
              name="tipHighestHalf"
              label="Tip — Highest Scoring Half"
              defaultValue={selected.tipHighestHalf}
              placeholder="2nd Half"
            />
          </div>

          <div className="space-y-4 rounded-lg border border-border/60 bg-secondary/30 p-4">
            <div>
              <h3 className="text-sm font-semibold">Ad Unlock</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Unity Ads plays the rewarded video inside the app. The direct link only opens a
                webpage, so it is used as a fallback when the video cannot load.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="adZoneId"
                label="Rewarded Ad Zone ID"
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
            <Button type="submit" variant="hero" disabled={saving || !matchDate}>
              <Save className="size-4" /> {saving ? "SAVING…" : "PUBLISH THIS MATCH"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving || !matchDate || !selected.published}
              onClick={clearMatch}
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
