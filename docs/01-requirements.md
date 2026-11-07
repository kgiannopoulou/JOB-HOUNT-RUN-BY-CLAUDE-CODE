# 1. Software requirements

## 1.1 Purpose

JOB HUNT helps one person run a job search from start to finish: find roles, understand them, judge the fit, tailor their documents, track what happened, and prepare for interviews. AI does the reading and drafting. The candidate makes every decision and sends every application.

## 1.2 Users

| Persona | Need |
| ------- | ---- |
| **Active job seeker** (primary) | Applying to many roles and needs speed, tailoring and a reliable record of what was sent |
| **Early-career candidate** | Needs to know which roles are realistic and how to present limited experience |
| **Passive candidate** | Applies rarely and wants saved searches and an honest fit score |

Recruiters and employers are out of scope. JOB HUNT is a candidate-side tool.

## 1.3 Scope

**In scope for v1**

- Account, profile and job preferences
- CV upload, parsing, versioning and PDF/DOCX export
- Job search through approved APIs, plus manual add by URL or pasted text
- Job description analysis
- CV-to-job match scoring with an explanation
- Tailored CV versions and cover letters
- Application tracking
- Interview preparation
- Job search analytics

**Out of scope for v1**

- Automatic application submission
- Scraping sites whose terms forbid it (including LinkedIn and Indeed)
- Native mobile apps
- Employer accounts
- Payments (the design leaves room for them through per-user usage limits)

## 1.4 Functional requirements

Priority: **M** must have, **S** should have, **C** could have.

### Accounts (AUTH)

| ID | Requirement | Pri |
| -- | ----------- | --- |
| AUTH-1 | Register and sign in with email and password, with email verification | M |
| AUTH-2 | Sign in with Google | S |
| AUTH-3 | Reset a forgotten password | M |
| AUTH-4 | Edit profile: name, headline, location, links | M |
| AUTH-5 | Set job preferences: titles, locations, remote policy, salary floor, seniority | M |
| AUTH-6 | Export all personal data | M |
| AUTH-7 | Delete the account and all its data | M |

### CV management (CV)

| ID | Requirement | Pri |
| -- | ----------- | --- |
| CV-1 | Upload a PDF or DOCX up to 4 MB, which fits Vercel's request limit | M |
| CV-2 | Parse the upload into structured sections with AI | M |
| CV-3 | Review and correct parsed data before it is used | M |
| CV-4 | Keep a master CV and any number of tailored versions | M |
| CV-5 | Export any version to PDF and DOCX | S |
| CV-6 | Report ATS readability problems such as tables or missing dates | C |

### Job discovery (JOB)

| ID | Requirement | Pri |
| -- | ----------- | --- |
| JOB-1 | Search by keyword, location, remote policy, seniority and date | M |
| JOB-2 | Add a job manually from pasted text | M |
| JOB-3 | Add a job from a URL where fetching is permitted | S |
| JOB-4 | Merge duplicates of the same job across sources | S |
| JOB-5 | Save, hide and label jobs | M |
| JOB-6 | Save searches and show new results | S |
| JOB-7 | Send a digest email for saved searches | C |

### Job analysis and matching (AI)

| ID | Requirement | Pri |
| -- | ----------- | --- |
| AI-1 | Extract title, seniority, required and preferred skills, responsibilities, salary, location and red flags | M |
| AI-2 | Score the fit from 0 to 100 against a chosen CV version | M |
| AI-3 | Explain the score with matched skills, gaps and evidence from the CV | M |
| AI-4 | Suggest CV edits per job and let the user accept or reject each one | M |
| AI-5 | Generate a cover letter with a chosen tone and length | M |
| AI-6 | Stream long generations so progress is visible | S |
| AI-7 | Never add experience, skills, employers, dates or qualifications the CV does not support | M |

### Application tracking (APP)

| ID | Requirement | Pri |
| -- | ----------- | --- |
| APP-1 | Create an application from a saved job or by hand | M |
| APP-2 | Move it through: saved, applied, screening, interview, offer, accepted, rejected, withdrawn | M |
| APP-3 | Record the exact CV version and cover letter that were sent | M |
| APP-4 | Keep notes, contacts, dates and a timeline of events | M |
| APP-5 | Warn before creating a duplicate application to the same job or company and role | M |
| APP-6 | Show reminders for follow-ups | S |
| APP-7 | Offer board and table views | S |

### Interview preparation (INT)

| ID | Requirement | Pri |
| -- | ----------- | --- |
| INT-1 | Generate likely questions from the job and CV | M |
| INT-2 | Practise by typing answers and receive structured feedback | M |
| INT-3 | Draft STAR stories from CV experience | S |
| INT-4 | Create a company brief from sources with links | C |
| INT-5 | Practise by voice | C |

### Analytics (ANL)

| ID | Requirement | Pri |
| -- | ----------- | --- |
| ANL-1 | Show the funnel from applied to offer | M |
| ANL-2 | Show applications over time and response rate | M |
| ANL-3 | Compare outcomes by source, CV version and match score | S |
| ANL-4 | Show the skills most often missing across saved jobs | S |
| ANL-5 | Show the user's own AI usage against their limit | S |

## 1.5 Non-functional requirements

| Area | Requirement |
| ---- | ----------- |
| Performance | Largest Contentful Paint under 2.5 s on the landing page. Non-AI API responses under 500 ms at p95. First streamed AI token under 5 s |
| Availability | 99.5% monthly target, inherited from Vercel and Supabase. AI failure must never block tracking or reading saved data |
| Scale | Designed for 10,000 users without structural change |
| Accessibility | WCAG 2.2 AA, full keyboard use, visible focus, reduced-motion support |
| Responsiveness | Works from 360 px phones to wide desktops |
| Browsers | Last two versions of Chrome, Edge, Firefox and Safari |
| Privacy | GDPR compliant. EU data residency for the database. See the [security plan](06-security-plan.md) |
| Cost | Per-user daily AI budget enforced server-side |
| Maintainability | TypeScript strict mode, linted, tested in CI, schema changes only through migrations |
| Internationalisation | English at launch, with text kept ready for extraction (Greek is the likely second language) |

## 1.6 Product rules

These are constraints on the product rather than features.

1. **The candidate stays in control.** JOB HUNT never submits an application or contacts anyone on the user's behalf.
2. **No invented experience.** Generated text must be traceable to the user's CV. Unsupported claims are flagged, not published.
3. **Scores are explained.** A match score always comes with its evidence and is presented as guidance.
4. **No fake data.** Empty states are real. Nothing is shown that the backend has not produced.
