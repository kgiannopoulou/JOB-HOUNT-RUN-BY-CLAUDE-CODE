# 4. Application pages

**Status:** ✅ exists now as a UI, with no backend. 🔜 planned.

## Public

| Route | Page | Purpose | Status |
| ----- | ---- | ------- | ------ |
| `/` | Landing | Explain the product and lead to registration | ✅ |
| `/login` | Login | Sign in | ✅ |
| `/register` | Registration | Create an account | ✅ |
| `/forgot-password` | Forgot password | Request a reset email | 🔜 Phase 3 |
| `/reset-password` | Reset password | Set a new password | 🔜 Phase 3 |
| `/auth/callback` | OAuth callback | Finish sign-in (route handler) | 🔜 Phase 3 |
| `/privacy`, `/terms` | Legal | Privacy notice and terms | 🔜 Phase 11 |

## Signed in

| Route | Page | Purpose | Status |
| ----- | ---- | ------- | ------ |
| `/dashboard` | Dashboard | Search status, next actions, recent activity | ✅ placeholder |
| `/jobs` | Jobs | Search and browse | ✅ placeholder |
| `/jobs/new` | Add job | Add from URL or pasted text | 🔜 Phase 5 |
| `/jobs/[id]` | Job detail | Analysis, match score, actions | 🔜 Phase 5 |
| `/jobs/[id]/cover-letter` | Cover letter | Generate and edit | 🔜 Phase 7 |
| `/cv` | CV library | Master CV and versions | ✅ placeholder |
| `/cv/[id]` | CV editor | Review parsed data and edit | 🔜 Phase 4 |
| `/cv/[id]/tailor/[jobId]` | Tailor | Accept or reject suggestions | 🔜 Phase 6 |
| `/applications` | Applications | Pipeline board and table | ✅ placeholder |
| `/applications/[id]` | Application detail | Timeline, documents, notes | 🔜 Phase 8 |
| `/interview` | Interview preparation | Sessions and question sets | ✅ placeholder |
| `/interview/[id]` | Practice session | Answer and get feedback | 🔜 Phase 9 |
| `/analytics` | Analytics | Funnel, trends, skill gaps | 🔜 Phase 10 |
| `/settings` | Settings | Profile, preferences, appearance, privacy | ✅ placeholder |

## Navigation

- **Desktop (1024 px and up):** full sidebar with labels.
- **Tablet (768 to 1023 px):** icon rail with tooltips.
- **Mobile (under 768 px):** top bar with a slide-out menu.

The sidebar and the slide-out menu both read from `src/config/navigation.ts`, so they cannot drift apart.

## Shared page states

Every data page must design four states: loading (skeletons), empty (explains the next step), error (with retry) and success. AI features add a fifth: refused or incomplete output, shown with a clear message rather than partial text.
