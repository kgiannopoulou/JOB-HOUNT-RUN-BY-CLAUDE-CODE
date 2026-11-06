# 7. Development roadmap

Each phase ends with something that works, with passing lint, build and tests. A phase's exit criteria must be met before the next one starts.

```mermaid
flowchart LR
    P1[1 Planning]:::done --> P2[2 Foundation]:::done --> P3[3 Auth and data] --> P4[4 CV] --> P5[5 Jobs and analysis]
    P5 --> P6[6 Match and tailor] --> P7[7 Cover letters]
    P7 --> P8[8 Tracking] --> P9[9 Interview] --> P10[10 Analytics] --> P11[11 Launch]
    classDef done fill:#d1fae5,stroke:#059669,color:#064e3b
```

| Phase | Name | Deliverables | Exit criteria | Status |
| ----- | ---- | ------------ | ------------- | ------ |
| 1 | Planning | Requirements, architecture, database, pages, API, security, roadmap, testing, risks | Plan approved | ✅ Done |
| 2 | Foundation | Next.js app, Tailwind, shadcn/ui, ESLint, layouts, navigation, all initial pages | Lint and build pass, app runs locally | ✅ Done |
| 3 | Auth and data | Supabase project, migrations, RLS, `proxy.ts`, login, registration, password reset, profile and preferences, CI, test setup, Vercel deployment | A user can register and sign in, and cross-user RLS tests pass | Next |
| 4 | CV management | Upload, AI gateway, AI parsing, review screen, versions, export | A real CV becomes editable structured data | Planned |
| 5 | Jobs and analysis | Source adapters, search, manual add, save and hide, job analysis | A user can find or add a job and read its analysis | Planned |
| 6 | Matching and tailoring | Score with evidence, tailoring suggestions, accept and reject, fabrication checks | A tailored version can be made with nothing unsupported | Planned |
| 7 | Cover letters | Streaming generation, tone options, editor | A letter is generated, edited and saved | Planned |
| 8 | Application tracking | Board and table, timeline, documents sent, reminders, duplicate warning | The full application lifecycle works | Planned |
| 9 | Interview preparation | Question generation, practice, feedback, STAR stories | A complete practice session works | Planned |
| 10 | Analytics | Funnel, trends, source and skill insights, real dashboard | Every figure comes from real data | Planned |
| 11 | Hardening and launch | Security review, accessibility and performance audits, legal pages, monitoring, data export, account deletion | The [pre-launch checklist](06-security-plan.md#66-pre-launch-checklist) is complete | Planned |

The prompt that started Phase 2 calls it "Phase 1 of the project". This roadmap counts planning as Phase 1, so application work starts at Phase 2.

## Minimum useful product

Phases 3 to 8 give a complete core loop: find a job, tailor documents, apply and track. Phases 9 to 11 could be reordered without blocking it.
