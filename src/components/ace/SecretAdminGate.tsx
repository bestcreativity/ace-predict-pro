import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Delete, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ADMIN_PIN_HASH, ADMIN_SESSION_KEY, hashPin } from "@/lib/ace";

export function SecretAdminGate() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const taps = useRef<number[]>([]);

  function handleTap() {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < 4000);
    if (taps.current.length >= 5) {
      taps.current = [];
      setPin("");
      setError(false);
      setOpen(true);
    }
  }

  function press(digit: string) {
    setError(false);
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (hashPin(next) === ADMIN_PIN_HASH) {
          window.sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
          setOpen(false);
          navigate({ to: "/admin" });
        } else {
          setError(true);
          setPin("");
        }
      }, 150);
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
            Enter the 4-digit access code to continue.
          </DialogDescription>

          <div className="mt-1 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={
                  "size-3 rounded-full transition-colors " +
                  (error ? "bg-destructive" : i < pin.length ? "bg-gold" : "bg-muted")
                }
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <Button key={d} variant="secondary" className="h-12 text-base" onClick={() => press(d)}>
                {d}
              </Button>
            ))}
            <Button variant="ghost" className="h-12" onClick={() => setPin("")}>
              Clear
            </Button>
            <Button variant="secondary" className="h-12 text-base" onClick={() => press("0")}>
              0
            </Button>
            <Button variant="ghost" className="h-12" onClick={() => setPin(pin.slice(0, -1))}>
              <Delete className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}