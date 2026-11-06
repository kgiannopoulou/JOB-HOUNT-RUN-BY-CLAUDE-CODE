# 8. Testing strategy

Test tooling is installed in Phase 3, when there is logic to test. Phase 2 is verified by lint, type checks, the production build and manual checks at each breakpoint.

## 8.1 Test levels

| Level | Tool | Covers | Runs |
| ----- | ---- | ------ | ---- |
| Static | TypeScript, ESLint | Types and code rules | Every push |
| Unit | Vitest | Validation, scoring helpers, deduplication, job adapters, cost calculation | Every push |
| Component | Testing Library | Forms, empty states, status changes | Every push |
| Integration | Vitest with local Supabase | Route handlers and queries against a real database | Every pull request |
| Security | Vitest with local Supabase | RLS: user A must never read or change user B's rows, for every table | Every pull request |
| End to end | Playwright | Register, upload CV, add job, score, generate letter, track | Every pull request, on the preview deployment |
| Accessibility | axe with Playwright | WCAG violations on each page | Every pull request |
| AI evaluation | Custom runner | See 8.3 | When prompts or the model change |
| Performance | Lighthouse CI | Core Web Vitals budgets | Every pull request |

## 8.2 External services in tests

- **Anthropic:** never called in normal CI. A fake client returns recorded responses, so tests are fast, free and repeatable.
- **Job sources:** adapters run against saved fixture responses. A scheduled weekly job checks that real responses still match.
- **Supabase:** real local instance through the Supabase CLI, because RLS cannot be tested with mocks.

## 8.3 AI evaluation

Normal tests cannot show whether generated output is good, so AI features get their own suite with a fixed data set of anonymised CVs and real job descriptions.

| Check | Method | Target |
| ----- | ------ | ------ |
| Extraction accuracy | Compare with hand-labelled fields | At least 90% field accuracy |
| Score consistency | Same input repeated | Spread of 10 points or less |
| Score ordering | Strong match must beat weak match | 100% of labelled pairs |
| Fabrication | Claims checked against the source CV | Zero unsupported claims |
| Injection resistance | Job texts containing attacks | Score unchanged, no leaked instructions |
| Schema validity | Every response parses | 100% |
| Cost | Tokens per feature | Within the budget set for each feature |

Prompts are versioned in code, and a prompt change must include its evaluation results. Runs spend real money, so they are started deliberately, not on every push.

## 8.4 CI gates

A pull request can merge only when lint, type checks, unit, integration, RLS and end-to-end tests and the production build all pass. Target coverage is 80% for `src/server` and `src/lib`. There is no target for UI code, where end-to-end tests give better value.
