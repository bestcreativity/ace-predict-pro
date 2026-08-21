# ACE PREDICT — Project Handoff Guide

> **Purpose:** This document lets a new AI assistant (or developer) understand the entire project
> quickly and continue work without losing context. Read this first before making any changes.

---

## 1. What This App Is

**ACE PREDICT** is a premium football (soccer) predictions app. It shows **5 daily prediction
slots** (match tips with odds, kickoff time, and confidence rating). Users unlock each prediction
by watching a rewarded ad. There is a hidden **admin dashboard** where the owner publishes
predictions and now tracks weekly win/loss performance.

**Tagline:** "We don't gamble, We invest"
**Telegram:** https://t.me/dacechannel

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | **TanStack Start** (React 19, file-based routing) |
| Styling | **Tailwind CSS v4** + Radix UI + shadcn-style components |
| Database | **Supabase** (hosted PostgreSQL) |
| Mobile shell | **Capacitor 8** (Android APK) |
| Ads | **AdMob** (native rewarded) + **Monetag** (web rewarded, via zone ID) |
| Build tool | Vite 8 (`vite build`, `vite.mobile.config.ts` for APK) |
| CI/CD | **GitHub Actions** (`.github/workflows/build-apk.yml`) builds the APK |

---

## 3. Repository Layout

The workspace root is `ace-predict-pro-main`. The **active project** is the subfolder
`ace-predict-pro/` (this is the Supabase-backed version — the one being actively developed).

```
ace-predict-pro-main/          ← workspace root
└── ace-predict-pro/           ← ★ ACTIVE PROJECT (Supabase version)
    ├── src/
    │   ├── routes/
    │   │   ├── index.tsx      ← public homepage, shows 5 prediction cards
    │   │   └── admin.tsx      ← admin dashboard (passcode-protected)
    │   ├── components/
    │   │   ├── ace/
    │   │   │   ├── PredictionCard.tsx      ← single prediction card w/ ad unlock
    │   │   │   ├── SecretAdminGate.tsx     ← hidden admin entry (12 taps)
    │   │   │   └── WeeklyTracker.tsx       ← ★ NEW: weekly win/loss tracker
    │   │   └── ui/            ← shadcn-style components (button, badge, etc.)
    │   ├── lib/
    │   │   ├── ace.ts         ← ★ core: Prediction + GameHistory types & API calls
    │   │   ├── supabase.ts    ← Supabase client
    │   │   ├── admob.ts       ← native AdMob rewarded ads
    │   │   └── rewarded-ad.ts ← Monetag / fallback ad logic
    │   └── mobile.tsx         ← mobile-specific entry
    ├── supabase/migrations/   ← ★ SQL migrations (run manually on Supabase)
    ├── android/               ← Capacitor Android project
    └── .github/workflows/build-apk.yml  ← CI: builds APK on push to main
```

> Note: there is also a sibling folder `ace-predict-pro-main/ace-predict-pro-main/` which is an
> older **localStorage-only** version. Ignore it unless explicitly asked.

---

## 4. How the Daily Prediction Flow Works

1. **Midnight (00:00 WAT / 23:00 UTC):** a Supabase cron job (`ace-daily-predictions`) calls an
   Edge Function that auto-generates 5 predictions from the API-Football API and fills the slots.
2. Users see the 5 predictions on the homepage and unlock them by watching ads.
3. **23:00 WAT (22:00 UTC):** a second cron job (`ace-clear-daily-predictions`):
   - **First** archives the day's published predictions into `ace_game_history`
     (via `ace_archive_game_history()`) with `result = 'pending'`
   - **Then** clears all 5 slots back to "Coming Soon"
4. The admin reviews archived games in the Weekly Tracker and marks each as **win** or **loss**.

---

## 5. Database Schema (Supabase)

### Table: `ace_prediction_slots` (the 5 live slots)
`slot` (1-5 PK), `published`, `team_a`, `team_b`, `league`, `kickoff`, `odds`, `tip`,
`confidence`, `ad_url`, `ad_zone_id`, `slip_image`, `updated_at`, `source`, `source_fixture_id`,
`source_date`, `generated_at`

### Table: `ace_game_history` (★ NEW — weekly tracking)
`id`, `game_date`, `slot`, `team_a`, `team_b`, `league`, `kickoff`, `odds`, `tip`, `confidence`,
`slip_image`, `result` (`pending`/`win`/`loss`), `created_at`.
Unique on `(game_date, slot)`.

### Key RPC functions (called from frontend via `supabase.rpc()`)
| Function | Purpose |
|----------|---------|
| `verify_ace_admin_passcode(passcode)` | Checks SHA-256 hash of admin passcode |
| `manage_ace_prediction_slot(...)` | Upserts a slot (requires passcode) |
| `ace_get_game_history(days)` | Returns last N days of archived games |
| `ace_set_game_result(passcode, date, slot, result)` | Marks a game win/loss/pending |
| `ace_archive_game_history()` | Called by cron to archive before clearing |

**Admin passcode** is verified by comparing SHA-256 against this stored hash (in the SQL):
`d6185f398d70f2956adbe828e6a703c7b113129c575819f99d412e1176b74619`

---

## 6. ⚠️ PENDING WORK (not yet done)

**The two SQL migrations for the weekly tracker have NOT been run on Supabase yet.**
Until they are run, the Weekly Tracker will show "No game history yet."

Run them in the Supabase SQL editor
(https://supabase.com/dashboard/project/cvpjzaiurdpdvgostjqj/sql/new), in this order:
1. `supabase/migrations/20260818000000_add_ace_game_history.sql`
2. `supabase/migrations/20260818001000_update_cron_archive_before_clear.sql`

---

## 7. Recent Work Completed (the "Weekly Game Tracker" feature)

The last major feature added lets the admin track weekly wins/losses. Files touched:
- `supabase/migrations/20260818000000_add_ace_game_history.sql` — new table + functions
- `supabase/migrations/20260818001000_update_cron_archive_before_clear.sql` — cron archives first
- `src/lib/ace.ts` — added `GameResult`, `GameHistoryEntry` types + `getGameHistory()` / `setGameResult()`
- `src/components/ace/WeeklyTracker.tsx` — NEW component (optimistic updates, collapsible day groups)
- `src/routes/admin.tsx` — renders `<WeeklyTracker passcode={passcode} />`
- `.github/workflows/build-apk.yml` — NEW CI workflow to build the APK

Git history (most recent first):
```
dafb4bd fix: set executable permission on gradlew for CI
5cc8237 fix: use Node 22 for Capacitor CLI
700262c fix: use npm install instead of npm ci
38cfb82 fix: sync package-lock.json for npm ci in CI
b560a1a fix: correct secrets syntax in workflow conditions
c579ab1 Create build-apk.yml
03cdb13 feat(admin): add weekly game tracker with win/loss history
```

---

## 8. Supabase Project Details

- **Project URL:** https://cvpjzaiurdpdvgostjqj.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/cvpjzaiurdpdvgostjqj
- **Client config:** `src/lib/supabase.ts` (anon/publishable key is public, safe to expose)
- Migrations are **not** auto-deployed. They must be run manually in the SQL editor.

---

## 9. Building & Shipping the APK

**Local build does NOT work** — the machine has insufficient RAM (Gradle JVM crashes with
"insufficient memory / paging file too small"). **Always build via GitHub Actions.**

- Pushing to `main` (when `src/`, `android/`, or the workflow file changes) auto-triggers the
  **Build APK** workflow.
- It builds a **debug APK** by default. For a signed **release APK**, add these GitHub Secrets
  (Settings → Secrets → Actions): `KEYSTORE_BASE64`, `KEY_ALIAS`, `KEY_PASSWORD`, `STORE_PASSWORD`.
- Download the APK from the run's **Artifacts** section (`ace-predict-debug-apk`, ~9.7 MB).

npm scripts (for reference): `dev`, `build`, `build:mobile`, `android:sync`, `android:apk`,
`android:release`.

---

## 10. Known Pitfalls & Hard-Won Lessons

1. **Workflow files can't be pushed via the local git token** — it lacks the `workflow` scope.
   Edit `.github/workflows/*.yml` through the GitHub **web UI** instead.
2. **`npm ci` fails in CI** because `package-lock.json` drifts out of sync. The workflow uses
   `npm install` instead.
3. **Capacitor CLI requires Node ≥ 22** — the workflow pins `node-version: 22`.
4. **`android/gradlew` needs the executable bit** for Linux CI — already fixed via
   `git update-index --chmod=+x android/gradlew`.
5. **GitHub Actions doesn't allow `secrets.X` in step-level `if:`** — map secrets to job-level
   `env:` first, then use `env.X` in conditions.
6. **Local Gradle builds crash (OOM)** — don't waste time trying; use GitHub Actions.
7. Admin session is stored in `sessionStorage` under key `ace:admin` (the passcode itself).

---

## 11. Admin Dashboard Access

- Hidden entry: tap a secret area **12 times** on the homepage (`SecretAdminGate.tsx`).
- Enter the admin passcode → verified server-side → session stored → `/admin` route unlocks.
- The admin page manages the 5 slots AND shows the Weekly Tracker at the bottom.

---

## 12. Code Conventions

- UI responsiveness is a priority: use **optimistic updates**, skeleton loaders, `React.memo`,
  CSS transitions (`duration-150/200`), and `active:scale-95` for tactile feedback.
- Design tokens: gold gradient (`text-gradient-gold`, `bg-[image:var(--gradient-gold)]`),
  `text-neon` (green/success), `text-gold` (warning/pending), `text-destructive` (red/loss),
  `surface-card` for card containers.
- Button variants: `hero` (gold gradient, primary), `neon`, `destructive`, `ghost`, `secondary`.
- Toasts via `sonner` (`toast.success` / `toast.error`).
- Keep comments minimal and match surrounding style.
