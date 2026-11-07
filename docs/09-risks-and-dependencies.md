# 9. Risks, dependencies and API limitations

Limits for third-party services change often. Figures marked *verify* come from general knowledge, not from a check made for this document, and must be confirmed before work on that feature begins.

## 9.1 Technical risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Job data coverage is weak, especially in Greece | High | High | Several sources behind one adapter interface, and manual add is a first-class feature from day one |
| AI invents or exaggerates CV content | Medium | High | Rule AI-7, evidence and fabrication checks, user review |
| Prompt injection through job text | Medium | Medium | See [security plan](06-security-plan.md#63-ai-specific-controls) |
| AI costs exceed the budget | Medium | High | Result cache, prompt caching, daily limits, effort set per feature |
| Real API rejects something the local stand-in accepts | Medium | Medium | The stand-in cannot prove schema or beta options are accepted, so run `npm run test:ai` once a key exists |
| Scanned PDFs have no text to read | Medium | Low | A clear message asks for a text PDF or DOCX. OCR is not built |
| Function timeouts on long AI calls | Medium | Medium | Streaming, background status pattern, batches for bulk work |
| Match scores vary between runs | Medium | Medium | Scoring rubric in the prompt, results stored per input hash, consistency evaluation |
| CV parsing fails on unusual layouts | High | Medium | Review screen before use, manual editing, DOCX text extraction as fallback |
| Refused or cut-off AI responses | Low | Medium | `stop_reason` checks, fallbacks, a clear UI state, no partial output saved |
| Misconfigured RLS leaks data | Low | Critical | RLS tests for every table, advisor checks in Supabase |
| Framework churn (Next.js 16 changes quickly) | Medium | Low | Versions pinned by the lockfile, bundled docs checked before using an API |
| Supabase free project pauses when idle | High on free tier | Low | Paid plan for production |

## 9.2 External dependencies

| Service | Used for | If it fails |
| ------- | -------- | ----------- |
| Supabase | Database, auth, files | App unavailable. This is the critical dependency |
| Vercel | Hosting, cron | App unavailable |
| Anthropic | All AI features | AI features show a retry message, everything else keeps working |
| Job source APIs | Search | Search degrades to the remaining sources, and manual add still works |
| Email provider | Auth email, digests | Supabase's built-in email is rate limited, so a custom SMTP provider is required before launch |

## 9.3 Job data sources

This is the largest product risk. **LinkedIn and Indeed offer no public job search API for this kind of use, and their terms forbid scraping, so they are excluded.** Users can still paste a job from any site.

| Source | Access | Coverage | Status and terms |
| ------ | ------ | -------- | ---------------- |
| **Remotive** | Public API, no key | Remote jobs only | **Integrated.** See below |
| Adzuna | Free API key | Many countries | Not integrated. Needs a key. The free tier is "intended for evaluating the API", and a licence is required for "any use in a product or service that generates revenue or leads". Personal job search is permitted. Each advert must be labelled and linked to Adzuna. *Verify:* the public docs do not confirm Greece |
| USAJOBS | Free API key | US federal jobs | Not integrated |
| Jooble | API key on request | Broad, includes Greece | *Verify:* terms and limits |
| Greenhouse, Lever, Ashby boards | Public per-company JSON | Companies that use them | Needs a list of companies to follow, and gives high-quality data |

### Remotive terms, read 2026-11-06

From the [API documentation](https://github.com/remotive-com/remote-jobs-api):

| Term | How JOB HUNT complies |
| ---- | --------------------- |
| "We advise max. 4 times a day", and more than 2 requests a minute are blocked | Searches never call Remotive. A sync runs at most every 6 hours, enforced in the database, and failed attempts count |
| "Link back to the URL found on Remotive AND mention Remotive as a source" | Every job links to its Remotive URL, and the page names Remotive with a link |
| Showing jobs "in order to collect signups/email addresses" is a breach | Job search is public, and an account is needed only to save jobs |
| Do not submit jobs to third-party platforms such as Google Jobs or LinkedIn Jobs | Jobs are not sent anywhere. Do not add `JobPosting` structured data to these pages |
| Jobs are delayed by 24 hours | Stated on the page |

**Limits to expect from this source:**

- **The free feed currently returns only 10 jobs in total.** This was measured on 2026-11-06. The integration works, but results stay sparse until another source is added.
- All jobs are remote, so the hybrid and on-site filters find nothing yet. The page says so.
- Salaries are free text, and often missing. Experience level is not provided, so it is read from the job title.
- Whether a commercial product may use the free API is unclear from the terms. Remotive offers a paid API starting at $5,000 a month. Ask them before launching commercially.

Most sources require attribution and a link back to the original listing, and some limit how long content can be stored. Terms must be read for each source before its adapter is built.

## 9.4 Anthropic API

Checked against current documentation (cached 2026-10-06). Check live pricing before budgeting.

| Model | ID | Input, per 1M tokens | Output, per 1M tokens | Context |
| ----- | -- | -------------------- | --------------------- | ------- |
| Claude Opus 5.5 | `claude-opus-5-5` | $4.00 | $20.00 | 1M |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | $2.00 | $10.00 | 1M |
| Claude Haiku 5.5 | `claude-haiku-5-5` | $0.10 | $0.50 | 1M |

Haiku prices apply up to 100K tokens per prompt.

| Limitation | Effect on the design |
| ---------- | -------------------- |
| Rate limits depend on the account's usage tier | Queue and retry on 429. The SDK retries twice by default |
| 32 MB per request and up to 600 pages for PDFs | Far above the 5 MB upload cap |
| Minimum cacheable prompt size depends on the model | A short CV may not cache, so measure `cache_read_input_tokens` |
| Batches are asynchronous | Suitable only for overnight scoring, not interactive work |
| Thinking tokens are billed | Effort must be tuned per feature |

## 9.5 Platform limits

| Service | Limit | Effect |
| ------- | ----- | ------ |
| Vercel | Function duration, request body size (about 4.5 MB) and cron frequency vary by plan, *verify* | CV uploads are limited to 4 MB to fit, because they pass through a server action. Plan affects the background design |
| Vercel Hobby | Non-commercial use only, *verify* | A paid plan is needed if the product charges users |
| Supabase Free | About 500 MB database, 1 GB storage, projects pause after a week of inactivity, *verify* | Fine for development, not for production |
| Supabase Auth email | Very low hourly limit on the built-in sender, *verify* | Custom SMTP before launch |

## 9.6 Current known issue

`npm audit` findings trace back to two root causes in tooling. Run it for the current count, which changes as packages update. The app's own code does not call either one.

| Root cause | Reached through | Automatic fix | Decision |
| ---------- | --------------- | ------------- | -------- |
| `minimatch` denial of service | `eslint-config-next` (development only), and `ts-morph` inside `shadcn` | Downgrade `eslint-config-next` to 15 and `shadcn` to 1.0 | Wait for upstream |
| `deepmerge` prototype poisoning (low) | `@shadcn/registry` inside `shadcn` | Downgrade `shadcn` to 1.0 | Wait for upstream |

`npm audit --omit=dev` still lists some of these, because `shadcn` is a production dependency: `globals.css` imports `shadcn/tailwind.css` from it. Only that stylesheet is used, at build time, and a scan of the build output found none of these packages. Before launch, copy the stylesheet into the project and move `shadcn` to `devDependencies`.
