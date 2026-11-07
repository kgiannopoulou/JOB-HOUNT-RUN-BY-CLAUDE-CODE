# Setup

## Run everything locally

You need Node.js 22 or later and Docker Desktop.

```bash
npm install
cp .env.example .env.local
npm run db:start
```

`db:start` prints the local keys. Copy `PUBLISHABLE_KEY` and `SECRET_KEY` into `.env.local`, and set `CRON_SECRET` to any long random value. Then:

```bash
npm run dev
```

Open <http://localhost:3000>. If that port is taken, run `npm run dev -- -p 3005` and set `SITE_URL=http://localhost:3005` in `.env.local`, because email links use it.

Local emails do not leave your computer. Read them at <http://127.0.0.1:54324>.

### Load real jobs

With the app running:

```bash
npm run jobs:sync
```

Remotive allows only a few requests a day, so the app makes one at most every 6 hours and skips the rest. `npm run db:reset` clears that history, so avoid repeating it just to sync again.

### Turn on AI features

Create a key at <https://platform.claude.com> and add it to `.env.local`:

```bash
ANTHROPIC_API_KEY=your-key
```

Restart the app, then confirm the key works against the real API. This costs a few cents:

```bash
npm run test:ai
```

Without a key the app still runs, and you can enter CV details by hand. `ANTHROPIC_MODEL` and `AI_DAILY_LIMIT` are optional, see `.env.example`. Add the same values to Vercel when you deploy. Never prefix them with `NEXT_PUBLIC_`.

## Connect a hosted Supabase project

1. Create a project at [supabase.com](https://supabase.com), in an EU region.
2. Link it and apply the migrations:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. From **Project Settings > API Keys**, copy the project URL, publishable key and secret key.
4. In **Authentication > URL Configuration**, set the site URL to your deployed address, and add `https://<your-domain>/**` to the redirect URLs.
5. In **Authentication > Sign In / Providers > Email**, keep **Confirm email** on and set the minimum password length to 8.
6. Before real users arrive, set up custom SMTP under **Authentication > Emails**, because the built-in sender has a very low hourly limit.

## Deploy to Vercel

1. Import the repository at [vercel.com](https://vercel.com).
2. Add these environment variables:

   | Name | Value |
   | ---- | ----- |
   | `SITE_URL` | Your deployed address, such as `https://example.vercel.app` |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
   | `SUPABASE_SECRET_KEY` | Secret key |
   | `CRON_SECRET` | A long random value |

3. Deploy. `vercel.json` runs the job sync daily at 06:00 UTC, and Vercel sends `CRON_SECRET` with the request.

Never add a `NEXT_PUBLIC_` prefix to the secret key, because that would publish it in browser code.

## Tests

| Command | Needs | Covers |
| ------- | ----- | ------ |
| `npm test` | Nothing | Normalisation, salary parsing, duplicates, filters, auth logic, secret handling, tailoring and letter checks, PDF rendering, tracker rules |
| `npm run test:integration` | Local Supabase | Row level security, search, job sync, authentication, CV versions, letters, application CRUD and status moves |
| `npm run test:e2e` | Local Supabase and `npm run build` | Full browser flows, using real emails from the local mail catcher |

Integration tests refuse to run against anything but a local database, because they create and delete users. No test calls a real job provider.

To run end-to-end tests for the first time on a machine without Chrome, use `npx playwright install chromium`.

## Add a job provider

1. Read the provider's terms and record them at the top of the adapter.
2. Create `src/server/jobs/providers/<name>.ts` implementing `JobProvider` from `src/server/jobs/types.ts`, with `minSyncIntervalMs` set to what the terms allow.
3. Register it in `src/server/jobs/providers/index.ts`, and add its attribution to `src/lib/job-providers.ts`.

Search, duplicate detection, sync limits and the interface then work without changes.
