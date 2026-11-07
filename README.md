# JOB HUNT

An AI-powered job search and career management platform. JOB HUNT will find relevant roles, analyse job descriptions, match them against your CV, tailor your CV and cover letters, track applications, prepare you for interviews and show analytics on your search.

![JOB HUNT landing page](docs/screenshots/landing.png)

![JOB HUNT job search](docs/screenshots/jobs.png)

## Project status

| Phase | Status |
| ----- | ------ |
| 1. Planning and architecture | ✅ Complete, see [docs](docs/README.md) |
| 2. Application foundation | ✅ Complete |
| 3. Database and authentication | ✅ Complete on local Supabase |
| 4. Job discovery | ✅ Complete, with Remotive as the first source |
| 5. AI CV analyzer | ✅ Built and tested. See the note on live AI below |
| 6. AI job matching | ✅ Built and tested. See the note on live AI below |
| 7 to 11. Cover letters, tracking, interviews, analytics, launch | Planned, see the [roadmap](docs/07-roadmap.md) |

**What works today:** registration with email confirmation, login, logout, password reset, private profiles and preferences, public job search over real listings with filters, saved jobs, private CV upload (PDF and DOCX), AI extraction with a required review step, a CV analysis dashboard, job matching with an explained score, and side-by-side job comparison. Applications and interview preparation are protected pages with no feature behind them yet, and they say so.

**Live AI:** the AI features need an `ANTHROPIC_API_KEY`. Without one the app still runs: CV upload and manual entry work, and AI buttons explain that they are off. Automated tests send AI calls to a local stand-in for the API, so the checks against the real service are in `npm run test:ai`, which has not been run yet because the project has no key.

**Known limit:** Remotive's free feed currently holds only 10 jobs, all remote. See [job data sources](docs/09-risks-and-dependencies.md#93-job-data-sources).

## How the AI features stay honest

- **The score is not written by AI.** The model reads the job and the CV and reports what each says. Fixed, tested rules in [`score.ts`](src/lib/matching/score.ts) turn that into a number, so the same reading always gives the same result.
- **Claims need proof.** A requirement earns credit only if its quote is found in the verified CV, and it counts only if its wording is in the job text. This also defeats job ads that tell the model to rate a candidate highly.
- **Mandatory comes first.** Mandatory requirements count three times as much as preferred ones, and missing one rules out a strong match.
- **People verify.** Nothing is analysed or matched until the user has reviewed and confirmed the extracted details. Values not found in the file are flagged on the review screen.
- **The original is kept.** The uploaded file and its text cannot be changed, and the score is never presented as a chance of being hired.

## Tech stack

- Next.js 16 (App Router), React 19 and TypeScript
- Tailwind CSS 4 and shadcn/ui
- Supabase: PostgreSQL with row level security, Auth and Storage
- Anthropic API (Claude Opus 5.5) with structured outputs, called only from server code
- Vitest, Testing Library and Playwright
- GitHub Actions

Planned: Vercel.

## Run it locally

You need [Node.js](https://nodejs.org) 22 or later and [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/kgiannopoulou/JOB-HOUNT-RUN-BY-CLAUDE-CODE.git
cd JOB-HOUNT-RUN-BY-CLAUDE-CODE
npm install
cp .env.example .env.local
npm run db:start
```

`db:start` prints your local keys. Add them to `.env.local`, then:

```bash
npm run dev
npm run jobs:sync
```

Open <http://localhost:3000>. The [setup guide](docs/setup.md) covers this in full, along with hosted Supabase, Vercel and adding job providers.

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build, including type checks |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |
| `npm run test:integration` | Run database tests against local Supabase |
| `npm run test:e2e` | Run browser tests against a production build, with a local stand-in for the AI API |
| `npm run test:ai` | Check the real Anthropic API. Needs a key and costs a few cents |
| `npm run db:start` / `db:stop` / `db:reset` | Manage local Supabase |
| `npm run db:types` | Regenerate database types |
| `npm run jobs:sync` | Fetch jobs, within the provider's limits |

## Project structure

```text
docs/                 Requirements, architecture, plans and setup
scripts/              Job sync and test runners
supabase/migrations/  Database schema, as versioned SQL
tests/                Unit, integration and end-to-end tests
src/
  app/
    (marketing)/      Landing page
    (auth)/           Login and registration
    (app)/            Dashboard, jobs, CV, matches, applications, interview prep, settings
    api/internal/     Job sync endpoint
    auth/confirm/     Email link handler
  components/
    ui/               shadcn/ui primitives
    layout/           Sidebar, top bar, navigation, logo, theme toggle
    shared/           Page header, empty state, stat card, phase badge
    marketing/        Landing page sections
    auth/             Authentication forms
    jobs/             Job search, filters and cards
    cv/               Upload, review form and analysis dashboard
    matching/         Requirement lists and the score notice
    settings/         Settings forms
    providers/        Theme provider
  config/             Site details and navigation
  lib/                Shared utilities, CV rules and the scoring engine
  server/             Server-only code: auth, Supabase clients, AI gateway, CV, matching, job sync
  types/              Generated database types
  proxy.ts            Session refresh and route redirects
```

## Documentation

The full plan is in [docs](docs/README.md): requirements, architecture, [database schema](docs/03-database-design.md), pages, API, security, roadmap, testing, risks and [open questions](docs/10-open-questions.md).
