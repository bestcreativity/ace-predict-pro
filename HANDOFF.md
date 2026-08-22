# 5 ACE PREDICT — Project Handoff Guide

> **Purpose:** This document lets a new AI assistant (or developer) understand the entire project
> quickly and continue work without losing context. Read this first before making any changes.

> **⚠️ MAINTENANCE RULE (important):** After making ANY change to this project (feature, bugfix,
> migration, config, or CI change), you MUST update this HANDOFF.md to reflect it — refresh the
> relevant sections and the git history in §7 — then commit & push it together with the code.
> This file is the single source of truth across chat sessions; keep it current.

---

## 1. What This App Is

**5 ACE PREDICT** is a premium football (soccer) predictions app. It shows **5 matches per day**,
each with **2 tips** (Over/Under 2.5 and Highest Scoring Half) — **no odds, no confidence**.
Predictions are **visible immediately** (no ad unlock); revenue comes from a Monetag banner.
Users switch between **Today** and **Tomorrow** tabs. There is a hidden **admin dashboard**
where the owner publishes/overrides matches, tracks weekly win/loss performance (one result
per match), and sees app install stats.

> Renamed from "ACE PREDICT" to **"5 ACE PREDICT"** on 2026-08-22 (all UI, HTML titles,
> Android launcher label, Capacitor appName). Package ID stays `com.acepredict.app`.

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
| Ads | **Monetag banner** (in-page push, zone 11589662 in `index.html`). All rewarded/video ads REMOVED. |
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
    │   │   ├── index.tsx      ← public homepage: Today/Tomorrow tabs, 5 match cards each
    │   │   └── admin.tsx      ← admin dashboard (passcode-protected), date-based editor
    │   ├── components/
    │   │   ├── ace/
    │   │   │   ├── PredictionCard.tsx      ← match card w/ 2 tips (shown directly, no lock)
    │   │   │   ├── SecretAdminGate.tsx     ← hidden admin entry (12 taps)
    │   │   │   ├── WeeklyTracker.tsx       ← weekly win/loss tracker (per match)
    │   │   │   └── InstallStatsPanel.tsx   ← ★ install/uninstall-proxy stats for admin
    │   │   └── ui/            ← shadcn-style components (button, badge, etc.)
    │   ├── lib/
    │   │   ├── ace.ts         ← ★ core: Match + MatchHistory types, API calls, device tracking
    │   │   ├── supabase.ts    ← Supabase client
    │   │   ├── version.ts     ← ★ APP_VERSION constant (shown on-screen)
    │   │   └── ad-placement.ts← pins the Monetag banner iframe to the bottom
    │   └── mobile.tsx         ← mobile-specific entry
    ├── supabase/migrations/   ← ★ SQL migrations (run manually on Supabase)
    ├── android/               ← Capacitor Android project
    └── .github/workflows/build-apk.yml  ← CI: builds APK on push to main
```

> Note: there is also a sibling folder `ace-predict-pro-main/ace-predict-pro-main/` which is an
> older **localStorage-only** version. Ignore it unless explicitly asked.

---

## 4. How the Daily Prediction Flow Works (Today / Tomorrow rotation)

**Business-day rule (core concept):** the active "today" advances at **23:00 WAT**, not midnight:
`business_today = (lagos_hour < 23) ? lagos_date : lagos_date + 1`. The Today tab shows matches
with `match_date = business_today`; the Tomorrow tab shows `business_today + 1`.

1. **23:00 WAT (22:00 UTC):** a single cron job (`ace-rotate-predictions`):
   - Archives that day's published matches into `ace_game_history` (`ace_archive_day(date)`,
     `result = 'pending'`) and deletes them from `ace_matches`.
   - Calls the Edge Function with `{ date: today + 2 }` to generate the **new tomorrow**
     (tomorrow's 5 matches already exist from the previous night — so "tomorrow becomes today"
     happens instantly at 23:00).
2. The Edge Function (`ace-daily-predictions`) accepts `{ date }` (defaults to tomorrow), fetches
   that day's fixtures from API-Football, and emits 2 tips per match:
   - **Over 2.5:** Poisson over/under on expected total goals.
   - **Highest Scoring Half:** compares expected 1H vs 2H goals ("1st Half"/"2nd Half"/"Both Equal").
3. Users browse both tabs — predictions are visible immediately, no unlock.
4. The admin reviews archived matches in the Weekly Tracker and marks each as **win** or **loss**.

**Install tracking:** every app open calls `ace_register_device` (upsert by stable device UUID
from localStorage). The admin's Install Stats panel shows totals; a device unseen for 7+ days is
reported as the uninstall proxy (true uninstall detection would need Firebase push).

---

## 5. Database Schema (Supabase)

### Table: `ace_matches` (live matches, replaces `ace_prediction_slots`)
`id`, `match_date`, `slot` (1-5), `published`, `team_a`, `team_b`, `league`, `kickoff`,
`tip_over25`, `tip_highest_half`, `slip_image`, `ad_zone_id`, `ad_url`,
`source`, `source_fixture_id`, `generated_at`, `updated_at`. Unique on `(match_date, slot)`.

### Table: `ace_game_history` (weekly tracking, one result per match)
`id`, `match_date`, `slot`, `team_a`, `team_b`, `league`, `kickoff`, `tip_over25`,
`tip_highest_half`, `result` (`pending`/`win`/`loss`), `created_at`. Unique on `(match_date, slot)`.

### Table: `ace_device_installs` (install tracking)
`device_id` (PK), `first_seen`, `last_seen`, `app_version`, `platform`. Written only via
`ace_register_device` (security definer); no direct RLS access.

### Key RPC functions (called from frontend via `supabase.rpc()`)
| Function | Purpose |
|----------|---------|
| `verify_ace_admin_passcode(passcode)` | Checks SHA-256 hash of admin passcode |
| `get_ace_matches_by_day()` | Returns `{ businessToday, businessTomorrow, today[], tomorrow[] }` |
| `manage_ace_match(...)` | Upserts a match for (date, slot) (requires passcode) |
| `ace_get_match_history(days)` | Returns last N days of archived matches |
| `ace_set_match_result(passcode, date, slot, result)` | Marks a match win/loss/pending |
| `ace_archive_day(date)` | service_role: archives a day into history, then deletes it |
| `ace_register_device(id, version, platform)` | Upserts a device row (install counting) |
| `ace_get_install_stats(passcode)` | Admin: total installs, active today/7d, android installs |

**Admin passcode** is verified by comparing SHA-256 against this stored hash (in the SQL):
`d6185f398d70f2956adbe828e6a703c7b113129c575819f99d412e1176b74619`

---

## 6. ✅ Migrations Status

Old migrations (superseded by the Today/Tomorrow restructure — kept for history):
- `20260818000000_add_ace_game_history.sql` — ✅ applied
- `20260818001000_update_cron_archive_before_clear.sql` — ✅ applied

**★ Current:** `supabase/migrations/20260821000000_today_tomorrow_matches.sql`
— creates `ace_matches`, recreates `ace_game_history`, drops `ace_prediction_slots` + old
functions, adds the new RPC functions and the `ace-rotate-predictions` cron (22:00 UTC).

**✅ COMPLETED (2026-08-22):**
1. Migration run in the Supabase SQL editor — new tables/functions created, rotation cron
   registered (jobid 5).
2. Edge Function re-deployed via the dashboard editor (updated timestamp confirmed live).
3. Both days seeded by calling the function with `{ "date": "2026-08-22" }` and
   `{ "date": "2026-08-23" }` (via `net.http_post` from SQL, cron secret pulled from vault).
   Verified: 5 published matches for each date in `ace_matches`.

**✅ APPLIED (2026-08-22):** `supabase/migrations/20260822000000_two_tips_and_install_tracking.sql`
— dropped the `tip_halffull` column, recreated `manage_ace_match` (without HT/FT) and
`ace_archive_day`, and added `ace_device_installs` + `ace_register_device` + `ace_get_install_stats`.
The edge function was redeployed immediately afterwards (no `tip_halffull` references).

**No pending database work remains.** From 23:00 WAT the cron handles everything:
archive today → generate today+2.

### Ad platform: Monetag banner only
All rewarded/video ads (AdMob, Unity Ads, Monetag rewarded) are REMOVED — predictions are
unlocked for free. Only the Monetag banner remains. See **§7.1**.

---

## 7.1 Ad Platform — Monetag banner only (all rewarded ads removed)

**Decision (2026-08-22):** the ad-unlock flow was removed entirely — predictions are visible
immediately. AdMob was already removed (2026-08-21); Unity Ads and Monetag rewarded were removed
with the unlock button (`unity-ads.ts` and `rewarded-ad.ts` deleted).

**What remains:**
- Monetag **in-page push banner**: script tag in `index.html` (zone `11589662`,
  `https://nap5k.com/tag.min.js`).
- `src/lib/ad-placement.ts` → `keepAdsBelowContent()` (called from `mobile.tsx`) pins the
  banner iframe to the bottom so it never covers content.

> Note: the native Unity Ads plugin (`UnityAdsPlugin.java` + gradle dependency) is still
> compiled into the Android shell but is dormant — nothing calls it. Safe to strip out later
> if APK size matters.

---

## 7. Recent Work Completed (latest: free predictions + install tracking)

**2026-08-22 — unlock removal, 2 tips, install stats:**
- Removed the ad-unlock flow: predictions show directly (`PredictionCard` simplified; unlock
  state/helpers removed from `ace.ts` and `index.tsx`).
- Dropped the Half/Full tip everywhere → 2 tips per match. Migration
  `20260822000000_two_tips_and_install_tracking.sql` (APPLIED), edge function redeployed.
- Install tracking: `ace_device_installs` table + `ace_register_device` / `ace_get_install_stats`
  RPCs; `registerDevice()` called from `__root.tsx` on every open; admin gets an
  `InstallStatsPanel` (total installs, active today/7d, inactive-uninstall proxy).
- Deleted `src/lib/unity-ads.ts` and `src/lib/rewarded-ad.ts`.

**2026-08-22 — Today / Tomorrow 3-Tip restructure** (HT/FT since removed):
- `supabase/migrations/20260821000000_today_tomorrow_matches.sql` — new tables, functions, cron
- `supabase/functions/ace-daily-predictions/index.ts` — accepts `{ date }`, emits tips per match
- `src/lib/ace.ts` — `Match`/`DayMatches`/`MatchHistoryEntry` types + `getMatchesByDay()`,
  `saveMatch()`, `getMatchHistory()`, `setMatchResult()`
- `src/routes/index.tsx` — Today/Tomorrow tabs, 30s refresh kept
- `src/routes/admin.tsx` — day selector + 5 match cards
- `src/components/ace/WeeklyTracker.tsx` — one result per match

Git history (most recent first):
```
0271ea3 feat: free predictions (no ad unlock), 2 tips per match, install tracking
7ffd573 feat(branding): rename app to 5 ACE PREDICT
8ecd638 docs: mark Today/Tomorrow migration, function deploy and seeding complete
caa4e75 feat: Today/Tomorrow tabs with 5 matches x 3 tips each (no odds/confidence)
d631cf9 feat(ui): show app version v1.4.0 on homepage + admin headers
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
- The admin page manages Today's and Tomorrow's 5 matches, shows the Install Stats panel and
  the Weekly Tracker at the bottom.

---

## 12. Code Conventions

- **App version is visible on-screen.** `src/lib/version.ts` exports `APP_VERSION`, shown as a small
  badge on the homepage header and admin header. Bump it on every deploy AND keep
  `versionName` in `android/app/build.gradle` in sync. Current: **1.7.0** (versionCode 8).
- UI responsiveness is a priority: use **optimistic updates**, skeleton loaders, `React.memo`,
  CSS transitions (`duration-150/200`), and `active:scale-95` for tactile feedback.
- Design tokens: gold gradient (`text-gradient-gold`, `bg-[image:var(--gradient-gold)]`),
  `text-neon` (green/success), `text-gold` (warning/pending), `text-destructive` (red/loss),
  `surface-card` for card containers.
- Button variants: `hero` (gold gradient, primary), `neon`, `destructive`, `ghost`, `secondary`.
- Toasts via `sonner` (`toast.success` / `toast.error`).
- Keep comments minimal and match surrounding style.
