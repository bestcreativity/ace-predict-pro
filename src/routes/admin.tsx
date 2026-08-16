import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ADMIN_SESSION_KEY, addCustomPrediction, DAYS, type DayKey } from "@/lib/ace";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Upload Prediction — ACE PREDICT Admin" },
      { name: "description", content: "Internal admin console for publishing ACE PREDICT tips." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "ACE PREDICT Admin" },
      { property: "og:description", content: "Internal admin console for publishing tips." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);
  const [slip, setSlip] = useState<string | undefined>();
  const [day, setDay] = useState<DayKey>("today");
  const [vip, setVip] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") setAllowed(true);
    else navigate({ to: "/" });
  }, [navigate]);

  if (!allowed) return null;

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSlip(String(reader.result));
    reader.readAsDataURL(file);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    addCustomPrediction({
      id: `c${Date.now()}`,
      teamA: String(f.get("teamA")),
      teamB: String(f.get("teamB")),
      league: String(f.get("league")),
      kickoff: String(f.get("kickoff")),
      day,
      odds: String(f.get("odds")),
      tip: String(f.get("tip")),
      confidence: Number(f.get("confidence")) || 70,
      vip,
      ...(slip ? { slipImage: slip } : {}),
    });
    toast.success("Prediction published");
    e.currentTarget.reset();
    setSlip(undefined);
  }

  return (
    <div className="shell-bg min-h-screen pb-20">
      <header className="mx-auto flex max-w-2xl items-center gap-3 px-4 pt-8">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-gradient-gold font-display text-2xl font-bold">Admin Upload</h1>
      </header>

      <form onSubmit={submit} className="surface-card mx-auto mt-6 max-w-2xl space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="teamA" label="Team A" placeholder="Arsenal" />
          <Field name="teamB" label="Team B" placeholder="Chelsea" />
          <Field name="league" label="League Name" placeholder="Premier League" />
          <Field name="kickoff" label="Match Time" placeholder="17:30" />
          <Field name="odds" label="Odds" placeholder="1.80" />
          <Field name="tip" label="Prediction" placeholder="Home Win" />
          <Field
            name="confidence"
            label="Confidence Level (%)"
            placeholder="85"
            type="number"
          />
          <div className="space-y-2">
            <Label>Match Day</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <Button
                  key={d.key}
                  type="button"
                  size="sm"
                  variant={day === d.key ? "hero" : "secondary"}
                  onClick={() => setDay(d.key)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant={vip ? "hero" : "secondary"} size="sm" onClick={() => setVip(!vip)}>
            {vip ? "VIP Pick" : "Free Pick"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" /> Upload Betting Slip
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pickImage}
          />
        </div>

        {slip ? (
          <img src={slip} alt="Betting slip preview" className="max-h-56 rounded-lg object-contain" />
        ) : null}

        <Button type="submit" variant="hero" className="w-full">
          <Upload className="size-4" /> PUBLISH PREDICTION
        </Button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} placeholder={placeholder} type={type} required />
    </div>
  );
}