# App Flow — Nuvela

**Document 3 of 6 — Planning Suite**
**Project:** INTE 21323 — Task Management System
**Status:** Locked baseline for implementation

---

## Purpose

This document maps how users move through Nuvela: every screen, how they connect, what each role sees, and what happens in the non-happy paths (empty, error, loading, and edge-case states). It is the structural foundation for the low-fidelity wireframes and everything downstream.

A note on roles: Nuvela has four roles (Owner, Admin, Project Manager, Collaborator) who experience genuinely different apps. Rather than four parallel maps, this document uses **one unified route list with per-role access and visibility annotated on each screen** — which is how it is actually built (shared routes protected by role guards).

A note on loading: per the design philosophy, **skeletons** are the default for content regions, **inline spinners** appear only on action controls (buttons mid-submit), the **board uses optimistic UI** (no loading indicator on drag), there are **no full-page spinners**, and the Render cold-start surfaces a calm "waking up" message if a fetch runs long.

A note on the public entry (v1 decision): Nuvela v1 ships a **splash screen** at `/` rather than a content-heavy marketing landing page. The splash is a brief branded moment that routes onward (to `/dashboard` with a valid session, otherwise to `/login`); it is not a destination and does not replace the signup/login entry points, which remain reachable (`/login` → `/signup`, with `/plans` linked). The full marketing landing page is deferred to a later version. This keeps v1 focused on the graded application itself and avoids investing in marketing copy that would be rewritten later; it also removes the screen most prone to looking generic. Throughout this document, `/` denotes the splash screen.

---

## Pages List

### Public (logged-out) routes

| Route | Description |
|---|---|
| `/` | Splash screen — a brief branded screen shown on load (the Nuvela mark on the brand canvas). It routes onward: to `/dashboard` if a valid session exists, otherwise to `/login`. It is a transient brand/loading moment, **not** a marketing page. *(v1 decision: the full marketing landing page is deferred to a later version; see note below. Sign up and Log in remain reachable via `/login` → `/signup`.)* |
| `/login` | Email + password login. |
| `/signup` | Owner self-registration (creates a new organization). |
| `/verify-email` | Lands here from the verification link; confirms the email and activates the account. |
| `/verify-email/pending` | Shown right after signup — "check your inbox" holding screen with a resend option. |
| `/forgot-password` | Request a password-reset email. |
| `/reset-password` | Set a new password from a reset link. |
| `/plans` | Static Free/Pro tiers, Pro marked "coming soon." Publicly viewable. |

### Authenticated (logged-in) routes

| Route | Access | Description |
|---|---|---|
| `/dashboard` | All roles | Role-aware landing after login. Task-focused for PM/Collaborator; organization overview for Admin. |
| `/projects` | Owner, PM | The manager's project list (their own projects only). Owner sees their own + can act as PM. |
| `/projects/:id` | Owner, PM, invited Collaborators | A project's Kanban board (To Do / In Progress / Review / Completed). |
| `/projects/:id/tasks/:taskId` | Same as project | Task detail — opens as a side panel over the board (deep-linkable route). |
| `/projects/:id/settings` | Owner, owning PM | Project settings — name, description, color, members, labels, archive, transfer ownership. |
| `/projects/archived` | Owner, PM | Archived projects (read-only), with unarchive. |
| `/users` | Owner, Admin | User management — create, view, edit, deactivate users; assign roles; resend invites. |
| `/notifications` | All roles | Full notification history with read/unread filters and "mark all read." |
| `/search` | All roles | Task search results, scoped to the user's access. (Also accessible via a global search field in the top bar.) |
| `/settings/account` | All roles | Personal account settings — name, password change, theme (light/dark) toggle. |
| `/settings/organization` | Owner | Organization settings — rename org. (Admins manage users at `/users`, not here.) |
| `/first-login/reset-password` | Admin-created users | Forced password reset gate on first login; blocks all other routes until completed. |

### System / fallback

| Route | Description |
|---|---|
| `/403` | Forbidden — shown (or rendered inline) when a role attempts a disallowed action. |
| `/404` | Not found — unknown route, or a resource the user cannot access (see privacy note in Edge Cases). |
| `/error` | Generic error boundary for unexpected failures. |

---

## Navigation Structure

**Primary navigation — left sidebar** (persistent on authenticated screens, collapsible for mobile/focus):
- The sidebar contents are **role-aware**:
  - **Collaborator:** Dashboard, My Projects (the projects they're invited to), Notifications, Search.
  - **Project Manager:** Dashboard, Projects, Archived, Notifications, Search.
  - **Admin:** Dashboard, Users, Notifications, Search. (No project/board entries — Admins don't access project contents.)
  - **Owner:** the full set — Dashboard, Projects, Archived, Users, Organization settings, Notifications, Search.

**Top bar** (persistent): global search field, the notification bell (unread badge + dropdown), the theme toggle, and an account menu (account settings, log out).

**Within a project:** the board is the default view; project settings is a tab/button on the project; the task detail opens as a **right-side panel** over the board (so the board stays visible behind it) and is also a deep-linkable route.

**Back behavior:** the side panel closes back to the board; archived/settings return to the project list; breadcrumbs (Org ▸ Project ▸ Task) orient the user inside nested project content.

**Mobile:** the sidebar collapses to a hamburger/drawer; the board scrolls horizontally across columns; the task detail panel becomes a full-screen overlay.

---

## Entry Points

**A brand-new visitor lands on `/` (the splash screen)** — a brief branded screen (the Nuvela mark on the brand canvas) that immediately routes onward: to `/dashboard` if a valid session exists, otherwise to `/login`. From `/login`, *Sign up* (become an Owner, create an org) is one tap away, and the `/plans` page is reachable from there. *(v1 deliberately ships a splash-into-login flow rather than a content-heavy marketing landing page — the landing page is deferred. The splash funnels into login/signup; it does not replace those entry points.)*

**A returning logged-in user** who hits `/` or `/login` is redirected straight to `/dashboard` (their session cookie is still valid).

**An invited user** (PM or Collaborator created by an Admin) doesn't self-register — they arrive via the onboarding email, click through, log in with their temporary password, and are forced through `/first-login/reset-password` before reaching the app.

---

## Auth Flow

### Owner self-registration
```
/signup  →  submit (name, email, password, org name)
         →  account + org created (inactive, pending verification)
         →  /verify-email/pending  ("check your inbox", resend available)
         →  user clicks email link  →  /verify-email  (token validated)
         →  account activated  →  redirect to /login (or auto-login)
         →  /dashboard  (empty-org first-run state)
```

### Admin-provisioned user onboarding (PM / Collaborator)
```
Admin at /users  →  create user (name, email, role)
                 →  system generates temp password, emails it (72h expiry)
User            →  /login with temp credentials
                 →  system detects "must reset" flag
                 →  /first-login/reset-password  (forced; blocks all other routes)
                 →  new password set (complexity enforced)
                 →  /dashboard
```

### Login (returning user)
```
/login  →  submit credentials
        →  success: set HTTP-only access + refresh cookies  →  /dashboard
        →  failure: stay on /login with an inline error (no redirect)
```

### Session and token handling
- A valid session cookie auto-redirects `/`, `/login`, `/signup` → `/dashboard`.
- An expired access token is silently refreshed via the refresh token; the user notices nothing.
- A fully expired/invalid session mid-use → redirect to `/login` with a "session expired" notice, preserving the intended destination to return to after re-login.

### Logout
```
any authenticated route  →  logout  →  cookies cleared  →  /  (splash → /login, no session)
```

---

## Key User Journeys

### Journey 1 — Owner sets up the workspace and creates the first project
The most important first-run journey; it's the activation moment.
```
Sign up  →  verify email  →  land on empty /dashboard
  →  empty state prompts "Create your first project" (Owner acting as PM)
  →  create project (name, description, color)  →  /projects/:id (empty board)
  →  empty board prompts "Add your first task"
  →  create task (title required; assignee optional — may stay unassigned)
  →  task appears in To Do
  →  (optional) invite a user: but the org has no other users yet,
      so the Owner is guided to /users to create one first (Admin power),
      then back to the project to invite them.
```
This journey deliberately surfaces the dependency: **users are created by Admin/Owner at the org level first, then invited to projects** — so the empty-org state guides the Owner through it rather than letting them hit a dead end at an empty invite list.

### Journey 2 — Collaborator works a task through the board
The core day-to-day loop, and where the role permissions become visible.
```
Log in  →  /dashboard (my assigned tasks, due-soon)
  →  click a task OR go to /projects/:id (an invited project)
  →  board shows all tasks; the Collaborator's assigned cards are theirs to move
  →  drag their task To Do → In Progress  (optimistic; moves instantly)
  →  open task detail panel: check checklist items, add a comment,
      @mention the PM, upload an attachment
  →  drag the task → Review  (allowed)
  →  attempt to drag → Completed: the Completed column is a disabled drop zone
      for Collaborators (lock icon + tooltip "Only the PM can complete tasks")
  →  the PM later moves it Review → Completed
```

### Journey 3 — PM offboards a Collaborator without orphaning work
The edge-case-heavy journey that shows the system handles real-world churn.
```
PM at /projects/:id/settings  →  Members  →  remove a Collaborator
  →  if that Collaborator has assigned tasks in this project:
       a reassignment dialog lists each task with a member-picker
       (reassign to a remaining member, or deliberately "leave unassigned")
  →  confirm  →  Collaborator removed; reassigned members notified;
       unassigned tasks show the muted placeholder
  →  if the Collaborator had no assigned tasks: removal is immediate, no dialog
```

(Parallel org-level journey — **Admin deactivates a PM**: at `/users`, deactivating a PM who owns projects opens a per-project transfer dialog requiring each project to be reassigned to another PM — no "leave unassigned" option for projects; blocked entirely if no other PM exists. The PM's task assignments in *other* projects auto-unassign and notify those owning PMs.)

---

## Empty States

| Screen | Empty state |
|---|---|
| Dashboard (new Owner) | Friendly first-run: "Welcome to Nuvela — create your first project to get started," with a primary action. Not a blank page. |
| Dashboard (Collaborator, nothing assigned) | "No tasks assigned to you yet" with a calm illustration; lists projects they're in if any. |
| Dashboard (Admin) | Org overview with zero users beyond themselves: "Add your team" prompt linking to `/users`. |
| Projects list | "No projects yet — create one" (PM/Owner). |
| Board (no tasks) | Each column shows a subtle "No tasks" placeholder; To Do shows "Add your first task." |
| Board column (empty, others have tasks) | Quiet muted placeholder within the column, not an error. |
| Members (project) | "No collaborators invited yet — invite from your organization." |
| Users list (org) | "No users yet — create your first team member." |
| Notifications | "You're all caught up" with a calm empty illustration. |
| Search (no results) | "No tasks match your search" with the query echoed and a hint to broaden it. |
| Archived projects | "No archived projects." |
| Task detail — comments | "No comments yet — start the conversation." |
| Task detail — attachments | "No files attached." |

---

## Error / Negative States

| Situation | Behavior |
|---|---|
| Failed login | Stay on `/login`; inline error ("Incorrect email or password"); never reveal which field was wrong. |
| Expired temp password | At login, message that the invite expired with guidance to ask an Admin to resend; Admin sees a "Resend invite" action at `/users`. |
| Invalid/expired verification link | `/verify-email` shows "This link is invalid or expired" with a resend option. |
| Duplicate email on user creation | Field-level error on the email input ("A user with this email already exists"). |
| Forbidden action (wrong role) | Server returns 403; UI shows an inline "You don't have permission" message or routes to `/403`. Forbidden controls are hidden or disabled in the first place, so this is a backstop. |
| Forbidden Completed move (Collaborator) | The drop is prevented client-side (disabled drop zone + tooltip); the server also rejects it as a backstop. |
| Network failure on a fetch | A non-destructive toast ("Couldn't load — retry") with a retry action; existing content stays on screen. |
| Network failure on an action (save/move) | The action reverts (optimistic rollback for the board) and a toast explains it; the user's input is preserved. |
| Form validation errors | Inline, field-level, immediate (Zod on the client); the backend re-validates and returns structured errors mapped back to fields. |
| File upload rejected | Inline error stating the reason (too large / unsupported type) with the limit shown. |
| Deactivating the only PM | Blocked with a clear message: "Assign another Project Manager before deactivating this one." |
| Session expired mid-action | Redirect to `/login` with "Your session expired"; return to the intended page after re-login. |
| Accessing a resource you can't see | Treated as 404 (not 403) to avoid revealing that the resource exists — see privacy note below. |
| Unexpected server error | Friendly error boundary (`/error`); never a raw stack trace; structured 500 logged server-side. |

---

## Component States

- **Buttons:** default, hover, focus, active, disabled, and a **loading** state (inline spinner + disabled) while an action is in flight (Save, Invite, Send, Create).
- **Inputs:** empty, focused, filled, error (red border + message), disabled. Password fields show complexity feedback during the forced reset.
- **Board columns:** normal; **drag-over** (highlighted drop target); **disabled drop zone** for the Completed column when a Collaborator drags (lock icon + tooltip).
- **Task cards:** default, hover (reveals quick actions for the PM), dragging (lifted/optimistic), with **stacked avatars** (loaded photo / initials-on-color fallback / "+N" overflow) and a **muted placeholder** when unassigned.
- **Checklist items:** unchecked, checked, with a progress indicator ("3/5"); only assignees/PM can toggle, others see them read-only.
- **Notification bell:** no-unread (plain), unread (badge with count), dropdown open vs closed; individual items read vs unread.
- **Theme toggle:** light vs dark; respects the chosen state across the app via semantic tokens.
- **Toasts:** success, error/warning, info; auto-dismiss with manual close; used for real-time events and action feedback.
- **Avatars:** image-loaded, initials fallback, overflow count, hover tooltip (full name).

---

## Edge Cases

- **Unassigned tasks** are a valid first-class state at any time, shown with the muted placeholder (not an error).
- **A task with many assignees** caps visible avatars (e.g. 3) and shows "+N"; the full list appears in the detail panel.
- **A user in multiple PMs' projects** sees each independently; removal from one doesn't affect the others.
- **Archived project** is fully **read-only** — no task moves, edits, comments, or notifications until unarchived; reachable only via the Archived view.
- **Voluntary project transfer** — a PM hands a project to another PM; the former owner remains a member by default and may leave manually; the receiver is notified.
- **PM deactivation** — per-project transfer (each project independently reassignable to a different PM); tasks the PM held elsewhere auto-unassign and notify those PMs.
- **Simultaneous real-time updates** — if another user moves a card you're viewing, your board updates live (the card animates to its new column); your own in-flight optimistic action reconciles against the server's truth, reverting with a toast on conflict.
- **Very long titles/descriptions** truncate with ellipsis on cards (full text in the detail panel); inputs enforce sensible max lengths.
- **Cold-start (Render)** — a fetch that runs long shows a skeleton that, after a few seconds, adds a calm "Waking up the server…" line rather than appearing frozen.
- **Owner acting as PM** — the Owner appears in PM-pickers (so projects can be transferred to them), which also resolves the "only one PM" deactivation block if the Owner takes the project.

---

## Loading States (applied philosophy)

| Context | Treatment |
|---|---|
| Dashboard, board, lists, task detail, notifications, search | **Skeletons** previewing the layout. |
| Action controls (Save/Invite/Send/Create) | **Inline spinner** on the button, button disabled. |
| Board drag-and-drop | **Optimistic** — card moves instantly; reconciles or reverts with a toast on failure. No loading indicator. |
| File upload | Progress indicator (bar where size is known); inline spinner otherwise. |
| Render cold-start | Skeleton + a delayed, calm "Waking up the server…" message. |
| Full-page | **Never a full-page spinner.** |

---

## Redirect Logic

| Action / situation | Destination |
|---|---|
| After signup | `/verify-email/pending` |
| After clicking verification link | `/login` (or auto-login) → `/dashboard` |
| After login (normal) | `/dashboard` |
| After login (Admin-created user, first time) | `/first-login/reset-password` (forced) |
| After completing forced reset | `/dashboard` |
| After logout | `/` (splash → `/login`, since no session) |
| Logged-in user visits `/` (splash), `/login`, `/signup` | `/dashboard` |
| Logged-out visitor on `/` (splash) | `/login` |
| Logged-out user visits any protected route | `/login` (intended destination remembered for after login) |
| Session expires mid-use | `/login` with "session expired"; return to intended page after re-login |
| After creating a project | `/projects/:id` (the new board) |
| After archiving a project | back to `/projects` |
| After unarchiving | `/projects/:id` (now active) |
| Forbidden action | inline 403 message, or `/403` |
| Unknown route / inaccessible resource | `/404` |

**Privacy note on 404 vs 403:** when a user requests a resource that exists but belongs to another tenant or another PM's project, Nuvela returns **404 (not found)** rather than 403 (forbidden), so the response never reveals that the resource exists. Genuine in-context permission errors (e.g. a Collaborator attempting a PM-only action on a project they *can* see) use 403.

---

*This App Flow is the locked structural baseline. It feeds the low-fidelity wireframes (Claude Design), then the high-fidelity mockups (Stitch, guided by the UI/UX Design Brief), with the Backend Schema and Implementation Plan building on the same structure.*
