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
     check on sign-up. Off while unset; sign-up also has a hidden honeypot field. The job seeker
     pre-registration form (/daftar/<slug>) uses it too when both the secret and a site key are set
     (`TURNSTILE_SITE_KEY`, or the same `VITE_TURNSTILE_SITE_KEY` read at runtime).
     Get both keys at dash.cloudflare.com → Turnstile → Add widget (free, no domain on Cloudflare
     needed): add `jobfair.co.id` (and any preview domain) as hostnames, mode "Managed". An answer
     is accepted only from those hosts, for its own form, and within 5 minutes; list more hosts in
     `TURNSTILE_HOSTNAMES` (comma separated). While the keys are missing on the live site the
     organiser's Pra-registrasi tab shows a red banner and the form falls back to a proof of work.
   - optional `PREREG_REQUIRE_CAPTCHA=1`: refuse pre-registrations while Turnstile is not set up
     (the form says it is being prepared) instead of falling back to the proof of work.
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
- `PREREG_RATE_PER_IP`: pre-registration sign-ups and changes per address per hour; default 30; raise when a campus registers together from one Wi-Fi.
- `PREREG_MAIL_PER_DAY`: pre-registration confirmation emails per day for all sign-ups together; default 60, leaving room on Resend's free 100/day; 0 turns them off (the code is always on screen).
- `PREREG_RATE_PER_NET`: pre-registration sign-ups per hour from one network (/24 for IPv4, /64 for IPv6), on top of the per-address limit; default 120.
- `PREREG_EVENT_BURST`: sign-ups to one event in 10 minutes before it goes into slow mode for 30 minutes (a harder proof of work without Turnstile, and a notice in the organiser's Pra-registrasi tab); default 300.
- `PREREG_POW_BITS`, `PREREG_POW_SLOW_BITS`: proof-of-work difficulty when Turnstile is off (about 2^bits hashes, worked out in the background while the person types); defaults 13 (well under a second on a mid-range phone) and 16 in slow mode.
- `PUSH_BATCH`: phone notifications sent at once (seminar pushes, reminders); default 50; raise to 100 when the functions have time to spare.
- `REMINDER_BUDGET_SEC`: how long one `/api/cron/reminders` run works before it stops and answers `more: true`; default 45. Accounts are marked before they are sent, so calling it again (e.g. cron-job.org every 5 minutes from 06.00 to 07.00 WIB) carries on with the rest and never sends twice.

## Players online: limits from env (no rebuild)
The game reads these from `GET /api/jobfair/config` (cached 60 s), so a change takes effect after
a redeploy of the env vars and a page reload, without rebuilding the game. Defaults fit Supabase
Free (200 connections, 100 messages/second, every broadcast counted once per receiver).
- `LIVE_ENABLED` (default `1`): players see each other. `0`: everyone plays solo with bots and no
  Realtime connection is made for it (calls still ring). The emergency switch for the event day.
- `LIVE_MAX_CONNECTIONS` (default `120`): players online together; the next one plays solo with
  "Ramai sekali, kamu masuk mode solo". `0` = no cap. Leaves room under Free's 200 for company
  portals, organisers and calls. Raise to ~450 on Pro with spend cap, ~9000 without.
- `LIVE_FLOOR_CAP` (default `10`): people per floor channel; a busier floor opens another channel,
  and people only see their own channel. Bigger = see more people, but each walker is updated
  less often on a small budget. Raise to 20–25 together with `LIVE_MSG_BUDGET`.
- `LIVE_MSG_BUDGET` (default `70`): Realtime messages/second that walking and chat may cost in
  total (the rest of the plan's limit is left for joins, leaves, calls and the stage). Raise to
  ~400 on Pro with spend cap (500/s), ~2000 without (2500/s).
- `LIVE_HEARTBEAT_SEC` (default `0` = off): a standing player repeats where they are this often.
  Presence already tells when someone leaves; set 30–60 only if people are seen in wrong places.
- `LIVE_CHAT_PER_MIN` (default `6`): speech bubbles one player may send to others per minute.

How the budget holds: a message on a channel of n people costs n. Every channel may carry
`LIVE_MSG_BUDGET / people online` broadcasts a second (people online is counted on arrival and
assumed 25% higher), shared fairly by whoever is walking or talking there, so all channels
together stay under `LIVE_MSG_BUDGET` even when all are full and busy. A walk is one message (the
route and the speed); other devices walk the player along it. Joining a floor costs about 2 × the
channel size (presence join and leave), plus one message to look at each channel. Measured with
the real code on an in-memory Supabase stand-in (`apps/demo/test/live-budget.test.ts`, run with
`MEASURE=1` to print): 100 players, 40 on one floor, a walk every ~17 s, a floor change every few
minutes: ~58 messages/second; everyone walking and chatting nonstop: ~82/second. 100 people
arriving within one minute cost ~60/second while they come in (within 20 seconds: ~125/second).

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
- Realtime runs on Supabase broadcast and presence channels (`apps/demo/src/live.ts`); on
  DigitalOcean the same `Net` interface gets a Socket.IO implementation. Channels are public: quick
  messages go to the receiver's own inbox channel, which anyone who knows the address could also
  listen to, so they carry only canned texts, never personal data.
