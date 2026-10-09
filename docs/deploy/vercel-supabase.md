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
   - optional `PASSWORD_LOGIN=1`: brings back the email-and-password forms (local testing).
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
