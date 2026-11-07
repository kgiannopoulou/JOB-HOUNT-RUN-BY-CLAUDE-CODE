# 10. Open questions

Nothing here blocked Phases 1 to 6. Each question has a default, and work continues on that default unless the project owner says otherwise. The "needed by" column shows when the answer starts to matter.

| # | Question | Default assumed | Needed by |
| - | -------- | --------------- | --------- |
| 1 | **Is this a personal tool, a portfolio project, or a product for real customers?** This drives legal work, hosting plans and how far Phase 11 goes | Portfolio project built to production standards, open to public registration | Phase 3 |
| 2 | **Which job markets matter most?** | Greece and EU remote roles | Now |
| 3 | **What is the monthly budget for AI and hosting?** | Free tiers during development, and a modest per-user daily AI limit | Phase 5 |
| 4 | **Should every feature use Claude Opus 5.5, or should simple ones use a cheaper model?** Haiku 5.5 costs about 1/40 as much per token as Opus 5.5, and could suit CV parsing and job analysis. Quality would need checking with the evaluation suite | Opus 5.5 for everything, with effort set per feature | Phase 5 |
| 5 | **Is Google sign-in wanted at launch?** | Yes, after email and password | Phase 3 |
| 6 | **Which languages?** Greek CVs and job ads are likely if Greece is a target market | English interface, with AI handling Greek input | Phase 5 |
| 7 | **Will it ever charge users?** | No payments in v1, but usage limits are per user so plans can be added later | Phase 11 |
| 8 | **Is the name final?** The repository is spelled `JOB-HOUNT` while the product is called JOB HUNT | The app uses JOB HUNT, and the repository name stays as created | Before launch |
| 9 | **Do you already have Supabase, Anthropic and Vercel accounts?** | Everything runs on local Supabase until they exist. See [setup](setup.md) | Before deployment |
| 10 | **Which job source comes next?** Remotive's free feed has only 10 jobs. Adzuna is the likely choice, and needs a free key from you | Remotive only | Now |
| 12 | **Should a reminder also send an email?** Reminders show in the app only. Email needs a sending service and a scheduled job | In the app only | Phase 11 |
| 11 | **Should job search stay public?** It is public because Remotive's terms forbid using its jobs to collect signups | Public, with an account needed only to save jobs | Before adding other sources |
