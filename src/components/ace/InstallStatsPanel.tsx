import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getInstallStats, type InstallStats } from "@/lib/ace";

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 px-2 py-2">
      <p className={`text-lg font-bold tabular-nums ${accent ?? ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Install/uninstall overview for the admin.
 *
 * "Total installs" counts every unique device that ever opened the app.
 * A device the app has not seen for 7+ days is reported as "inactive" — the
 * best uninstall proxy available without Firebase push (an app cannot detect
 * its own uninstall on Android).
 */
export function InstallStatsPanel({ passcode }: { passcode: string }) {
  const [stats, setStats] = useState<InstallStats | null>(null);

  useEffect(() => {
    let active = true;
    getInstallStats(passcode)
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        /* Stats are a nice-to-have; never block the admin page on them. */
      });
    return () => {
      active = false;
    };
  }, [passcode]);

  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="text-sm font-semibold">App Installs</h2>
      {!stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBox label="Total Installs" value={String(stats.totalInstalls)} />
          <StatBox label="Active Today" value={String(stats.activeToday)} accent="text-neon" />
          <StatBox label="Active (7 days)" value={String(stats.active7d)} accent="text-neon" />
          <StatBox
            label="Inactive / Uninstalled"
            value={String(Math.max(0, stats.totalInstalls - stats.active7d))}
            accent="text-destructive"
          />
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        "Inactive / Uninstalled" counts devices not opened for 7+ days — an uninstall proxy.
        Exact uninstall detection would require Firebase push notifications.
      </p>
    </section>
  );
}
