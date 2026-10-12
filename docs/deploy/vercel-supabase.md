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
   - Seminar and Aula broadcasts (optional; the defaults fit Supabase Free). The game reads them from
     `GET /api/jobfair/config` (public, cached 60 s), so a change needs a redeploy of env only, no rebuild:
     - `STAGE_MESH_MAX_VIEWERS` (default `8`): viewers the speaker's laptop streams to directly when a session
       is set to "Platform kita"; the rest see slides only. Raise only for a strong laptop and upload (~1 Mbps each).
     - `STAGE_BEAT_SEC` (default `10`): how often a live speaker tells every player it is on air; each beat
       costs one message per player online. Lower (e.g. `3`) on Supabase Pro for a quicker "LIVE" badge.
     - `STAGE_CHAT_ENABLED` (default on; `0` turns stage chat, questions and reactions off).
     - `STAGE_CHAT_COOLDOWN_SEC` (default `10`): least seconds between two chat messages from one viewer.
     - `STAGE_REACT_COOLDOWN_SEC` (default `3`): the same for reactions.
     - `STAGE_CHAT_BUDGET` (default `30`): Realtime messages per second the room's chat and reactions may
       cost, every watcher receiving counted; past it the room goes into slow mode. Raise to ~300 on
       Supabase Pro (500/s), ~1500 without the spend cap (2,500/s).
     For a big audience set the session to "YouTube atau Vimeo (link)" (Panitia → Seminar or Aula) and
     stream to YouTube Live: viewers watch the embed, which costs no Realtime messages and no upload from
     the speaker.
4. A daily Vercel cron calls `/api/health`, so the free Supabase project never sits idle long
   enough to be paused.

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
