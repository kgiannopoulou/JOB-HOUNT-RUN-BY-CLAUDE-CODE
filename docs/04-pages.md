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
| `/cv` | CV library | Upload and list CVs | ✅ |
| `/cv/[id]` | CV details | Read, review and confirm details, see the analysis dashboard | ✅ |
| `/cv/[id]/download` | Original file | Redirects to a link that expires in 60 seconds (route handler) | ✅ |
| `/cv/versions/[id]` | CV version | Review every AI change, choose a template, arrange sections, preview and edit | ✅ |
| `/cv/versions/[id]/pdf` | Version PDF | Download a reviewed version (route handler) | ✅ |
| `/cover-letters` | Cover letters | Generate a letter and list saved ones | ✅ |
| `/cover-letters/[id]` | Cover letter | Review, edit, restore and delete | ✅ |
| `/cover-letters/[id]/pdf` | Letter PDF | Download a reviewed letter (route handler) | ✅ |
| `/matches` | Matches | Saved results, highest first, and selection for comparison | ✅ |
| `/matches/[id]` | Match result | Score, categories, gaps, evidence and how the score was calculated | ✅ |
| `/matches/compare` | Compare jobs | Two to four results side by side | ✅ |
| `/applications` | Board | Kanban board, search, filters, what is due | ✅ |
| `/applications/list` | List | The same data, sortable | ✅ |
| `/applications/calendar` | Calendar | Month grid on desktop, agenda on phones | ✅ |
| `/applications/stats` | Statistics | Rates, stages reached, weekly activity | ✅ |
| `/applications/new` | Add application | For a job found elsewhere, with a duplicate warning | ✅ |
| `/applications/[id]` | Application detail | Details, recruiter, outcome, documents sent, interviews, reminders, history | ✅ |
| `/interview` | Interview preparation | Start a session for an application, and see past sessions | ✅ |
| `/interview/[id]` | Practice session | Practice or mock interview, with feedback and earlier attempts | ✅ |
| `/analytics` | Analytics | Key figures, weekly activity, status distribution | ✅ |
| `/notifications` | Notifications | Read, dismiss and check for new ones | ✅ |
| `/settings` | Settings | Profile, preferences, notifications, time zone and appearance work. Data export and deletion arrive in Phase 11 | ✅ |

## Navigation

- **Desktop (1024 px and up):** full sidebar with labels.
- **Tablet (768 to 1023 px):** icon rail with tooltips.
- **Mobile (under 768 px):** top bar with a slide-out menu.

The sidebar and the slide-out menu both read from `src/config/navigation.ts`, so they cannot drift apart.

## Shared page states

Every data page must design four states: loading (skeletons), empty (explains the next step), error (with retry) and success. AI features add a fifth: refused or incomplete output, shown with a clear message rather than partial text.
