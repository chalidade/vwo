# Trial hosting: Vercel + Supabase

For the trial (tens of people) the web app and API run on Vercel Hobby and the database on
Supabase Free. For the event everything moves to one DigitalOcean droplet (`deploy/` on the
`deploy-digitalocean` branch). The code is the same in both places; only env vars change.

## Setup
1. Supabase: new project in Southeast Asia (Singapore). From **Connect**, copy the
   **Transaction pooler** URL (port 6543) and the **Session pooler** URL (port 5432).
2. Vercel: import `chalidade/vwo`, Root Directory `apps/web`. `apps/web/vercel.json` sets the
   region (`sin1`) and the build, which runs migrations on production deploys only.
3. Vercel env vars (Production):
   - `DATABASE_URL`: transaction pooler URL (the app turns prepared statements off for port 6543)
   - `MIGRATE_DATABASE_URL`: session pooler URL (migrations need a session)
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (publishable key): players see each other through
     Supabase Realtime. Read at build time, so redeploy after changing them.
   - `ADMIN_EMAILS`: comma-separated accounts of the organisers. They run the organiser pages and
     every booth. Companies run only their own booth: an organiser sets the booth's PIN (Panitia →
     Stand → PIN) and gives it to the company with the booth code; the company signs in with
     Google and joins once in the company portal. A company that books an empty stand runs it
     straight away and gets a PIN for colleagues. Panitia → Stand → Akun lists and removes them.
   - `RESEND_API_KEY`, `MAIL_FROM`: verification and password reset emails. Once set, an account
     must verify its email before applying.
   - `CRON_SECRET` (any long random string, e.g. `openssl rand -hex 32`): protects the daily
     reminder job (`/api/cron/reminders`, 06.00 WIB), which sends each seeker an email and phone
     notification for today's interviews, office visits, the Aula items they asked to be
     reminded of and the seminars they registered for (plus tomorrow's seminars, H-1). Vercel
     Cron sends it automatically; without it the job refuses to run.
     The "15 menit lagi" and "seminar dimulai" pushes go out when visitors load the game and when
     the speaker goes live. To have them on time even when nobody is online, point a free
     scheduler (e.g. cron-job.org) at `GET /api/cron/seminars` every 5 minutes with the header
     `Authorization: Bearer <CRON_SECRET>`; Vercel Hobby cron only runs once a day. Each push is
     sent once however often it runs.
   - `APP_URL`: domain used in email links (defaults to the production `.vercel.app` URL)
   - `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` (Cloudflare Turnstile, free): human
     check on sign-up. Off while unset; sign-up also has a hidden honeypot field.
   - optional `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`: a TURN relay for calls
     between networks where direct WebRTC fails (public STUN is used either way)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: "Masuk dengan Google". Google Cloud Console →
     OAuth client (Web application) with redirect URI `https://<domain>/api/auth/google/callback`
     for every domain the site is served on; publish the consent screen. Google is the only way
     to sign up and sign in; an older email-and-password account signs in with Google on the
     same email and keeps its data.
   - `SITE_LAUNCHED=1`: open the app to everyone. Until it is set, jobfair.co.id shows the
     coming-soon page and `/play` only opens for organisers (`ADMIN_EMAILS`), accounts that run a
     booth, and companies whose registration an organiser verified (they sign in at
     `/masuk-panitia` or `/masuk-perusahaan`). Companies register at `/daftar-perusahaan`.
   - `XENDIT_SECRET_KEY`, `XENDIT_CALLBACK_TOKEN`: real payments through Xendit (coin packages,
     booth registration, company bills). Secret key from Xendit → Settings → API Keys with
     Money-in write access (`xnd_development_…` is test mode, `xnd_production_…` takes real money);
     the token from Settings → Webhooks, where the "Invoices paid" URL is
     `https://<domain>/api/payments/xendit/webhook`. While the key is unset every payment is a
     simulation that charges nothing and is recorded as "Simulasi (tanpa uang)".
   - optional `PAYMENTS_OPEN`: set to `0` between events to switch buying coins off (the wallet
     says it is closed and the server refuses coin purchases). Unset or any other value: open.
   - optional `PREVIEW_SECRET`: signs the pre-launch pass cookie (falls back to `DATABASE_URL`).
   - optional `PASSWORD_LOGIN=1`: brings back the email-and-password forms (local testing).
4. A daily Vercel cron calls `/api/health`, so the free Supabase project never sits idle long
   enough to be paused.

## API and database load (optional env vars)
All optional; the defaults suit Vercel Pro with Supabase Free. The game reads the polling ones
from `GET /api/jobfair/config` (no redeploy needed; browsers pick them up on their next visit).
The public setup (`/api/jobfair/state`), the public visit totals and booth ratings are the same for
everyone and are kept by Vercel's CDN; what is per account (`/api/jobfair/state/mine`, own stats,
own reviews) is never cached. Big inline pictures (logos) are served from
`/api/jobfair/state/media/<hash>` and kept by browsers for good. Nothing is polled while the tab is hidden.
- `DB_POOL_MAX`: Postgres connections per Vercel instance; default 3 (10 off Vercel); raise only on a paid Supabase compute whose pooler takes more clients (Free: 200 in total, shared by every instance).
- `STATE_CDN_SEC`: seconds the CDN serves the public setup before asking again; default 20; raise to 60 for a quieter event, 0 turns CDN caching off.
- `STATE_SWR_SEC`: seconds the CDN may serve the old setup while it fetches the new one; default 60; rarely needs changing.
- `STATE_INLINE_MAX`: pictures in the setup longer than this (characters) are served by hash; default 4096; raise to a huge number to keep them inline.
- `STATS_CACHE_SEC`: seconds an instance reuses the visit totals, and the CDN keeps the public ones; default 30; lower (10) if organisers want livelier counters and the database has room.
- `STATE_POLL_SEC`: seconds between a visitor's pulls of the event setup; default 60 (was 30); lower to 30 when the budget allows.
- `APPLICATIONS_POLL_SEC`: seconds between pulls of a seeker's applications and HR's answers; default 30 (was 15); lower to 15 for chattier HR replies.
- `STATS_POLL_SEC`: seconds between pulls of the visit totals; default 120 (was 30); lower for livelier counters.
- `STATS_SEND_SEC`: seconds between sends of a player's visits and clicks; default 30 (was 15); lower if the live feed should move faster.
- `PROGRESS_POLL_SEC`: seconds between pulls of an account's progress saved on another device; default 90 (was 45); rarely needs changing.
- `PROGRESS_PUSH_SEC`: at most one progress save per this many seconds, only when something changed; default 8 (was 4); lower to 4 on a paid plan.
- `REVIEWS_POLL_SEC`: seconds between pulls of booth ratings; default 180 (was 60).
- `FRIENDS_POLL_SEC`: seconds between pulls of the friends list; default 180 (was 90).
- `PORTAL_POLL_SEC`: seconds between pulls of a booth's applicants in the company portal; default 15 (was 8); lower to 8 when HR teams chat live.
- `GOOGLE_RATE_PER_IP`: Google sign-ins started per address per 10 minutes; default 300 (was 30); raise for a big venue or campus behind one Wi-Fi address.
- `GOOGLE_RATE_PER_DEVICE`: the same per address and browser; default 30; rarely needs changing.
- `PUSH_BATCH`: phone notifications sent at once (seminar pushes, reminders); default 50; raise to 100 when the functions have time to spare.
- `REMINDER_BUDGET_SEC`: how long one `/api/cron/reminders` run works before it stops and answers `more: true`; default 45. Accounts are marked before they are sent, so calling it again (e.g. cron-job.org every 5 minutes from 06.00 to 07.00 WIB) carries on with the rest and never sends twice.

## What keeps the move to DigitalOcean free of rework
- Only plain Postgres through Drizzle. No Supabase Auth, Storage or REST client in the app.
- Rate limits are counted in Postgres (`rate_limits`), so they work across serverless functions
  and on one server alike.
- Moving the data: `pg_dump -Fc "$SESSION_POOLER_URL" > jobfair.dump`, then `pg_restore` into the
  droplet's database, then point `DATABASE_URL` there.

## Security
- Migration `0003_lock_public_api` turns on row level security on every table and revokes
  Supabase's `anon`/`authenticated` roles, so the project's public REST/GraphQL API exposes
  nothing even if the anon key leaks. `test/security.test.ts` fails if a new table misses it.
- Security headers (HSTS, frame denial, nosniff, referrer and permissions policy) come from
  `next.config.ts`, so both hosts send them.
- Never put a database URL in a `NEXT_PUBLIC_*` variable; those are shipped to browsers.
- Each account's game progress (`fair_players`) is client-reported: coins are play money while
  payments are a demo. Move the coin balance to server-side rules before coins buy anything real.
- Realtime runs on Supabase broadcast channels (`apps/demo/src/live.ts`); on DigitalOcean the same
  `Transport` interface gets a Socket.IO implementation.
