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
| `/jobs/new` | Add job | Add from URL or pasted text | 🔜 Phase 6 |
| `/jobs/[id]` | Job detail | Analysis, match score, actions | 🔜 Phase 6 |
| `/jobs/[id]/cover-letter` | Cover letter | Generate and edit | 🔜 Phase 7 |
| `/cv` | CV library | Master CV and versions | 🟡 |
| `/cv/[id]` | CV editor | Review parsed data and edit | 🔜 Phase 5 |
| `/cv/[id]/tailor/[jobId]` | Tailor | Accept or reject suggestions | 🔜 Phase 6 |
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
