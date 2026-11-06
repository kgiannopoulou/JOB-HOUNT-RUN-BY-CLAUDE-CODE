# 5. Backend API endpoints

Two server routes exist today, and everything else here is planned for the phases shown in the [roadmap](07-roadmap.md).

| Method | Path | Purpose | Auth |
| ------ | ---- | ------- | ---- |
| GET | `/auth/confirm` | Finish email confirmation and password reset links | Link token |
| GET | `/api/internal/cron/sync-jobs` | Sync job providers, within their limits | `Authorization: Bearer $CRON_SECRET` |

Sign-in, registration, profile changes and saving jobs are server actions in `src/server`. Job search reads the `search_jobs` database function from a Server Component.

Planned endpoints live under `/api/v1`. Simple form mutations use server actions that share the same validation and service code. Route handlers are used where a stable URL is needed, such as streaming, uploads and cron.

## Conventions

- **Auth:** Supabase session cookie, except cron routes, which need `Authorization: Bearer $CRON_SECRET`.
- **Input:** validated with Zod. Unknown fields are rejected.
- **Pagination:** cursor based, `?limit=20&cursor=...`, with a maximum limit of 100.
- **Streaming:** `text/event-stream`.
- **Errors:**

```json
{ "error": { "code": "budget_exceeded", "message": "Daily AI limit reached.", "requestId": "..." } }
```

| Status | Used for |
| ------ | -------- |
| 400 | Validation failure |
| 401 / 403 | Not signed in / not allowed |
| 404 | Not found, also returned for other users' rows |
| 409 | Duplicate application |
| 413 / 415 | File too large / unsupported type |
| 422 | AI refused or returned incomplete output |
| 429 | Rate limit or daily AI budget reached |
| 502 / 503 | Upstream AI or job source failure |

## Account

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/me` | Current profile and usage |
| PATCH | `/me` | Update profile and preferences |
| POST | `/me/export` | Start a data export |
| GET | `/me/export/:id` | Export status and link |
| DELETE | `/me` | Delete the account, with re-authentication |

Registration, sign-in and password reset use Supabase Auth directly, so they are not listed here.

## CVs

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/cvs` | List CVs |
| POST | `/cvs` | Upload a file and start parsing |
| GET | `/cvs/:id` | CV with parse status |
| PATCH | `/cvs/:id` | Rename or set as primary |
| DELETE | `/cvs/:id` | Delete a CV and its file |
| GET | `/cvs/:id/versions` | List versions |
| POST | `/cvs/:id/versions` | Create a version |
| GET | `/cv-versions/:id` | Read a version |
| PATCH | `/cv-versions/:id` | Edit, rejected if the version was already sent |
| GET | `/cv-versions/:id/export?format=pdf` | Export as PDF or DOCX |

## Jobs

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/jobs` | Add from text or URL |
| GET | `/jobs/:id` | Job with analysis and latest match |
| GET, POST | `/saved-searches` | List or create |
| PATCH, DELETE | `/saved-searches/:id` | Update or delete |

## AI features

All run through the AI gateway, count towards the daily budget and return cached results when the input is unchanged.

| Method | Path | Purpose | Delivery |
| ------ | ---- | ------- | -------- |
| POST | `/jobs/:id/analysis` | Analyse a job | JSON |
| POST | `/jobs/:id/match` | Score against `cvVersionId` | JSON |
| POST | `/jobs/:id/tailoring` | Suggest CV edits | JSON |
| POST | `/cv-versions/:id/apply-suggestions` | Create a tailored version from accepted edits | JSON |
| POST | `/jobs/:id/cover-letters` | Generate a cover letter | Stream |
| GET | `/cover-letters/:id` | Read a letter | JSON |
| PATCH | `/cover-letters/:id` | Save edits | JSON |
| DELETE | `/cover-letters/:id` | Delete | JSON |

## Applications

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/applications` | List and filter |
| POST | `/applications` | Create, 409 on duplicate |
| GET | `/applications/:id` | Detail with timeline |
| PATCH | `/applications/:id` | Update status, notes, documents |
| DELETE | `/applications/:id` | Delete |
| POST | `/applications/:id/events` | Add a timeline note |

## Interview preparation

| Method | Path | Purpose | Delivery |
| ------ | ---- | ------- | -------- |
| GET | `/interview-sessions` | List sessions | JSON |
| POST | `/interview-sessions` | Create and generate questions | JSON |
| GET | `/interview-sessions/:id` | Session with questions | JSON |
| DELETE | `/interview-sessions/:id` | Delete | JSON |
| POST | `/interview-questions/:id/answer` | Submit an answer, get feedback | Stream |

## Analytics

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/analytics/funnel` | Stage counts and conversion |
| GET | `/analytics/activity?range=90d` | Applications over time |
| GET | `/analytics/sources` | Outcomes by source |
| GET | `/analytics/skills` | Most frequent skill gaps |
| GET | `/analytics/usage` | AI usage against the limit |

## Internal

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/internal/cron/saved-searches` | Refresh saved searches |
| GET | `/internal/cron/batch-collect` | Collect finished AI batches |
| GET | `/internal/cron/cleanup` | Apply retention rules |
| GET | `/health` | Liveness check, no sensitive data |
