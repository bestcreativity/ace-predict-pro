import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_PIN_HASH, ADMIN_SESSION_KEY, hashPin } from "@/lib/ace";

export function SecretAdminGate() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const taps = useRef<number[]>([]);

  function handleTap() {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < 8000);
    if (taps.current.length >= 12) {
      taps.current = [];
      setPin("");
      setError(false);
      setOpen(true);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hashPin(pin) === ADMIN_PIN_HASH) {
      window.sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      setOpen(false);
      navigate({ to: "/admin" });
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <>
      <button
        aria-label="."
        onClick={handleTap}
        className="fixed bottom-0 right-0 z-40 flex h-12 w-12 items-center justify-center bg-transparent"
      >
        <span
          className="rounded-full bg-foreground opacity-30"
          style={{ width: 12, height: 12 }}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs border-border bg-popover">
          <DialogTitle className="flex items-center justify-center gap-2 font-display text-base">
            <ShieldCheck className="size-4 text-gold" /> Admin Access Passcode
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            Enter the admin access passcode to continue.
          </DialogDescription>

          <form onSubmit={submit} className="mt-2 space-y-3">
            <Input
              type="password"
              autoFocus
              value={pin}
              maxLength={21}
              onChange={(e) => {
                setError(false);
                setPin(e.target.value);
              }}
              placeholder="Passcode"
              className={error ? "border-destructive" : ""}
            />
            {error ? (
              <p className="text-center text-xs text-destructive">Incorrect passcode.</p>
            ) : null}
            <Button type="submit" variant="hero" className="w-full">
              Unlock
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}