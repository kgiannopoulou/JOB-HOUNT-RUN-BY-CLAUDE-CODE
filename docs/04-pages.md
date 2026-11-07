# 4. Application pages

**Status:** ✅ working. 🟡 protected page with no feature behind it yet. 🔜 planned.

## Public

| Route | Page | Purpose | Status |
| ----- | ---- | ------- | ------ |
| `/` | Landing | Explain the product and lead to registration | ✅ |
| `/login` | Login | Sign in | ✅ |
| `/register` | Registration | Create an account | ✅ |
| `/forgot-password` | Forgot password | Request a reset email | ✅ |
| `/reset-password` | Reset password | Set a new password | ✅ |
| `/auth/confirm` | Email links | Finish confirmation and reset links (route handler) | ✅ |
| `/jobs` | Jobs | Search real listings. Public, because Remotive's terms forbid showing its jobs to collect signups | ✅ |
| `/privacy`, `/terms` | Legal | Privacy notice and terms | 🔜 Phase 11 |

## Signed in

| Route | Page | Purpose | Status |
| ----- | ---- | ------- | ------ |
| `/dashboard` | Dashboard | Real counts and next steps | ✅ |
| `/jobs/saved` | Saved jobs | The user's saved jobs | ✅ |
| `/jobs/new` | Add job | Add from URL or pasted text | 🔜 Not scheduled |
| `/jobs/[id]` | Job detail | Full job page | 🔜 Not scheduled. Job cards link to matches |
| `/jobs/[id]/cover-letter` | Cover letter | Generate and edit | 🔜 Phase 7 |
| `/cv` | CV library | Upload and list CVs | ✅ |
| `/cv/[id]` | CV details | Read, review and confirm details, see the analysis dashboard | ✅ |
| `/cv/[id]/download` | Original file | Redirects to a link that expires in 60 seconds (route handler) | ✅ |
| `/cv/[id]/tailor/[jobId]` | Tailor | Accept or reject suggestions | 🔜 Not scheduled |
| `/matches` | Matches | Saved results, highest first, and selection for comparison | ✅ |
| `/matches/[id]` | Match result | Score, categories, gaps, evidence and how the score was calculated | ✅ |
| `/matches/compare` | Compare jobs | Two to four results side by side | ✅ |
| `/applications` | Applications | Pipeline board and table | 🟡 |
| `/applications/[id]` | Application detail | Timeline, documents, notes | 🔜 Phase 8 |
| `/interview` | Interview preparation | Sessions and question sets | 🟡 |
| `/interview/[id]` | Practice session | Answer and get feedback | 🔜 Phase 9 |
| `/analytics` | Analytics | Funnel, trends, skill gaps | 🔜 Phase 10 |
| `/settings` | Settings | Profile, preferences and appearance work. Data export and deletion arrive in Phase 11 | ✅ |

## Navigation

- **Desktop (1024 px and up):** full sidebar with labels.
- **Tablet (768 to 1023 px):** icon rail with tooltips.
- **Mobile (under 768 px):** top bar with a slide-out menu.

The sidebar and the slide-out menu both read from `src/config/navigation.ts`, so they cannot drift apart.

## Shared page states

Every data page must design four states: loading (skeletons), empty (explains the next step), error (with retry) and success. AI features add a fifth: refused or incomplete output, shown with a clear message rather than partial text.
