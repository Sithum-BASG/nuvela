# Implementation Plan (Detailed Build Manual) — Nuvela

**Document 6 of 6 — Planning Suite**
**Project:** INTE 21323 — Task Management System
**Status:** Locked build roadmap — authoritative, step-by-step

---

## How to use this document (read first — applies to every phase)

This is a precise build manual, not a sketch. It exists to prevent the AI from inventing structure, stacks, fields, or behavior. The following rules are **binding for the entire build**:

1. **Do not invent.** Use only the stack, fields, routes, and rules defined in the locked documents (PRD, TRD, App Flow, UI/UX Design Brief, Backend Schema, this plan). If something is genuinely unspecified, STOP and ask — do not guess, do not substitute a "common" default.
2. **Single source of truth per concern.** Data model = Backend Schema's Prisma file (verbatim). Stack/versions = TRD. Screens/states/redirects = App Flow. Colors/tokens/typography = Design Brief. Never contradict these; never silently "improve" them.
3. **No alternative libraries.** The approved dependency list is in the TRD and reproduced per-phase below. Do not swap in a different ORM, auth library, state manager, component library, or hosting provider. If a named package seems unavailable, STOP and ask rather than substituting.
4. **Build in the phase order below.** Do not start a phase whose prerequisites aren't met. Do not build UI for a feature whose API doesn't exist yet.
5. **Every phase ends with explicit done-criteria.** Do not proceed until each is verifiably true. "It compiles" is not "done."
6. **Security and multi-tenancy are not optional and not deferrable.** Every query is scoped by `organizationId`. Every protected route is guarded. These are written into each phase, not retrofitted.
7. **When generating code, prefer the smallest correct change.** Do not refactor unrelated code, do not restructure folders that already match the spec, do not add speculative features. Out-of-scope items are in the PRD; respect them.
8. **Cite the source for non-obvious choices in code comments** (e.g. `// HTTP-only cookie per TRD auth section`) so reviewers can trace decisions.

**Canonical stack (from TRD — do not deviate):** Next.js (TypeScript, App Router) + Tailwind + shadcn/ui + dnd-kit + Lucide on Vercel; NestJS (TypeScript) + Prisma + Socket.IO + Passport-JWT + bcrypt + class-validator + @nestjs/throttler on Render; PostgreSQL + Storage on Supabase; Resend for email. TypeScript everywhere.

**Prioritization (SRS rubric):** DevOps 20, Frontend 20, Backend 20, Security 15, Real-Time 10, Database 10, Documentation 5. This drives two ordering decisions: deploy early (Phase 2), auth before features (Phase 3).

---

## Phase 0 — Foundations, Repo, Tokens

**Goal:** a clean, themed, runnable skeleton for both deployables.

### 0.1 Repository
- Create a **public** GitHub repo named `nuvela`.
- Structure (two-folder; do not collapse frontend into backend or vice versa):
```
nuvela/
  /backend        # NestJS
  /frontend       # Next.js
  /docs           # the six planning documents
  README.md
  .gitignore      # node_modules, .env, dist, .next
```
- Branch strategy: `main` (protected), feature branches `feat/<area>`, PRs into `main`, meaningful commit messages. Never commit secrets.

### 0.2 Backend init
- `cd backend && nest new .` (NestJS, package manager: npm).
- Install (exact set; do not add others here): `@nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/throttler @nestjs/swagger @nestjs/websockets @nestjs/platform-socket.io socket.io class-validator class-transformer bcrypt prisma @prisma/client cookie-parser`.
- Folder structure (MVC/modular per SRS):
```
backend/src/
  main.ts
  app.module.ts
  prisma/            # PrismaService + schema
  common/            # guards, decorators, filters, interceptors
  auth/              # controller, service, strategies, dto
  users/
  organizations/
  projects/
  tasks/
  columns/
  labels/
  comments/
  attachments/
  activity/
  notifications/     # + websocket gateway
  search/
  mail/              # Resend wrapper (single email module)
```
- Each feature module follows: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, with business logic in services (controllers stay thin).

### 0.3 Frontend init
- `cd frontend && npx create-next-app@latest .` — TypeScript: yes, App Router: yes, Tailwind: yes, `src/` dir: yes, alias `@/*`.
- `npx shadcn@latest init` — then add components as needed per screen (button, input, dialog, dropdown-menu, table, tabs, badge, avatar, skeleton, sonner/toast, card, select, checkbox).
- Install: `@tanstack/react-query zod react-hook-form @hookform/resolvers @dnd-kit/core @dnd-kit/sortable lucide-react socket.io-client date-fns`.
- Folder structure:
```
frontend/src/
  app/               # App Router routes (see App Flow routes)
  components/ui/      # shadcn primitives
  components/         # composed app components
  lib/               # api client, socket client, utils
  hooks/             # data hooks (React Query)
  providers/         # query provider, auth provider, theme provider
  types/             # shared TS types (mirror Prisma where useful)
```

### 0.4 Design tokens FIRST (critical for consistency)
- Before building any screen, wire the **Design Brief tokens** into the Tailwind config + shadcn CSS variables: the Soft Indigo ramp (`accent-tint #EDEBFB`, `accent #7C74D6`, `accent-strong #5A52B5`, dark-mode `#8B83E0`/`#A79FEA`), neutrals (light/dark), semantic colors, radii (8px controls / 12px cards), the type scale (Sora for display/headings, Roboto for UI/body — per the Design Brief, loaded via `next/font/google`). Define both `:root` (light) and `.dark` values.
- Set up the **theme provider** with light/dark toggle (no hard-coded hex anywhere in components — tokens only).

### 0.5 Env management
- Commit `.env.example` listing every variable from the TRD (`DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FRONTEND_URL`, `BACKEND_URL`, `NODE_ENV`). Real values never committed.

### 0.6 Backend Dockerfile (now, not later)
- Multi-stage Dockerfile for the NestJS app (build then run on Node LTS). Forces a deployable shape early.

**Done when:** `npm run start:dev` (backend) and `npm run dev` (frontend) both run locally; the frontend renders a shadcn Button in **both light and dark** using the token system; the repo structure matches the trees above exactly; `.env.example` is complete; the Dockerfile builds.

---

## Phase 1 — Database & Migrations

**Goal:** the full relational model live in Supabase, with seed data.

### 1.1 Prisma schema
- Copy the **Backend Schema's Prisma file verbatim** into `backend/prisma/schema.prisma`. Do not rename models, fields, or relations; do not add/remove fields. The models are: Organization, User, Project, ProjectMember, Column, Task, TaskAssignee, Label, TaskLabel, ChecklistItem, Comment, CommentMention, Attachment, ActivityLog, Notification, RefreshToken. The enums are: Role, UserStatus, Priority, ProjectStatus, NotificationType, ActivityType.
- Configure datasource: `url = env("DATABASE_URL")` (pooled), `directUrl = env("DIRECT_URL")` (direct).

### 1.2 Migrate
- `npx prisma migrate dev --name init`. Verify in Prisma Studio that all 16 tables, all enums, all `@@unique` constraints (e.g. `[organizationId, email]`, `[projectId, userId]`, `[taskId, userId]`, `[taskId, labelId]`) exist.
- Create `PrismaService` (NestJS) and a module that exports it.

### 1.3 Seed
- Write `prisma/seed.ts` creating: 1 Organization; 1 Owner (ACTIVE, verified); 1 Admin; 2 PMs; 3 Collaborators; 2 Projects (each with the 4 seeded Columns); ~8 Tasks spread across columns and priorities, some unassigned, some multi-assigned; a few Labels and ChecklistItems; ProjectMembers linking Collaborators to projects. This seed is reused for testing and as the demo's pre-provisioned accounts.
- **Column seeding rule:** every new project gets exactly these four columns in order — To Do (pos 0), In Progress (pos 1), Review (pos 2), Completed (pos 3, `isCompletedColumn=true`, `isPmGated=true`). Encode as a reusable function used in both seed and project creation.

**Done when:** `prisma migrate` applies cleanly to Supabase; the seed runs and Prisma Studio shows the full graph; the four-column seeding function is the single place columns are created.

---

## Phase 2 — Deploy Skeleton Early (DevOps 20%)

**Goal:** empty-but-running apps live at public HTTPS URLs, CI green.

### 2.1 Backend → Render
- Add a `GET /health` endpoint returning `{status:'ok'}`.
- Deploy from the Dockerfile to Render (Node, WebSocket-enabled). Set env vars in Render's config.
- Confirm the public HTTPS URL serves `/health`.

### 2.2 Frontend → Vercel
- Connect the repo; Vercel auto-detects Next.js. Set env vars.
- Confirm the public HTTPS URL renders the themed skeleton.

### 2.3 Cross-origin wiring
- Backend CORS: allow the exact Vercel origin (`FRONTEND_URL`) with `credentials: true` (required for HTTP-only cookies). Do not use `*` with credentials.
- Frontend API client points at `BACKEND_URL`; make one fetch to `/health` to prove cross-origin works.

### 2.4 Supabase
- Confirm DB reachable from the deployed backend. Create a **private** Storage bucket `attachments`.

### 2.5 CI
- GitHub Actions: on PR, run lint + typecheck + build (and tests once they exist) for both apps.

**Done when:** both apps are live at HTTPS URLs; the deployed frontend calls the deployed backend's `/health` across origins with CORS configured; CI passes on a PR; the private `attachments` bucket exists.

---

## Phase 3 — Authentication & RBAC (Security 15%; foundation for all features)

**Goal:** full auth backbone, all four roles, multi-tenant guards — before any feature.

### 3.1 Password & tokens
- `bcrypt` hashing helper (cost >= 10). Never store/log plaintext.
- JWT: access token (short expiry) + refresh token (longer). Payload: `{ userId, role, organizationId }`. Sign with the two separate secrets.
- Deliver both tokens as **HTTP-only cookies** (`httpOnly`, `Secure`, `SameSite=None`, scoped path). Use `cookie-parser`.
- `RefreshToken` table: store **hashed** refresh tokens; support rotation on refresh and revocation on logout/deactivation.

### 3.2 Guards & decorators (in `common/`)
- `JwtAuthGuard`: validates the access cookie; **401** on missing/invalid/expired.
- `RolesGuard` + `@Roles(...)` decorator: **403** on insufficient role.
- `@CurrentUser()` decorator: extracts `{ userId, role, organizationId }`.
- A tenant-scoping helper so every service query filters by `organizationId`. Cross-tenant access returns **404** (not 403) — do not reveal existence.

### 3.3 Auth endpoints (exact list — build all)
```
POST /auth/signup                 # name,email,password,orgName -> Org+Owner (PENDING, unverified)
POST /auth/verify-email           # token -> activate
POST /auth/login                  # email,password -> set cookies (reject if PENDING/unverified/DEACTIVATED)
POST /auth/refresh                # rotate access token from refresh cookie
POST /auth/logout                 # revoke refresh, clear cookies
POST /auth/first-login/reset-password   # mustResetPassword flow, complexity enforced
POST /auth/forgot-password        # send reset email (Resend)
POST /auth/reset-password         # token -> new password
```

### 3.4 Onboarding specifics
- Owner signup creates Organization + Owner; sends verification email (Resend); account inactive until verified.
- Admin-created users (used in Phase 4, mechanics built here): generate a secure temp password, set `mustResetPassword=true`, `tempPasswordExpiresAt = now+72h`, email it. On first login, if `mustResetPassword`, force reset before any access. Resend-invite regenerates temp password + expiry.
- Rate-limit auth endpoints with `@nestjs/throttler`.

### 3.5 Frontend auth
- Screens: `/login`, `/signup`, `/verify-email`, `/verify-email/pending`, `/first-login/reset-password`, `/forgot-password`, `/reset-password` (per App Flow, styled per Design Brief — centered cards, accent only on primary CTA).
- Auth provider + protected-route handling; **redirect logic exactly per the App Flow redirect table**.
- Silent access-token refresh on expiry; session-expired -> `/login` with notice.

**Done when (verify each):** all four roles authenticate; tokens are in HTTP-only cookies (confirm in dev tools — not localStorage); forbidden actions return 401/403; cross-tenant returns 404; Owner signup->verify->dashboard works on the **deployed** env; Admin-create->temp-password->forced-reset works end-to-end; refresh and logout (revocation) work.

---

## Phase 4 — Organizations, Users & Projects

**Goal:** the structural entities, in dependency order. (Auth from Phase 3 gates all of these.)

### 4.1 Users (Admin/Owner only)
```
GET    /users                     # list, searchable/filterable by role+status (org-scoped)
POST   /users                     # create PM/Collaborator (Admin); Admins cannot create Admins
PATCH  /users/:id                 # edit details / assign role
POST   /users/:id/deactivate      # soft-deactivate (PM -> triggers transfer flow, see 4.4)
POST   /users/:id/resend-invite   # regenerate temp password + 72h expiry, re-email
```
- Owner-only: `POST /organization/admins`, `DELETE /organization/admins/:id`, `PATCH /organization` (rename).
- Frontend: User Management screen (table with avatar/name/email/role/status + actions menu: Edit, Assign role, Resend invite, Deactivate), Create User modal (name, email, role dropdown PM/Collaborator, "temp password will be emailed" note). Admin dashboard (org overview).

### 4.2 Projects (PM/Owner)
```
GET   /projects                   # caller's own (manager) + member-of, filtered view
POST  /projects                   # create (name, description, color) -> seeds 4 columns
GET   /projects/:id               # members/manager/owner only; else 404
PATCH /projects/:id               # owning PM/Owner only
POST  /projects/:id/archive       # -> status ARCHIVED (read-only)
POST  /projects/:id/unarchive
POST  /projects/:id/transfer      # voluntary transfer to another PM
```
- Frontend: project list (filtered per role), create-project, project settings (General/Members/Labels/Danger Zone), archived list.

### 4.3 Membership
```
GET    /projects/:id/members
POST   /projects/:id/members      # invite an existing org user (from minimal directory)
DELETE /projects/:id/members/:userId   # triggers reassignment dialog (see 4.4)
```
- A PM sees a minimal org user directory (name+email) only for invitation.

### 4.4 Reassignment / transfer flows (the edge-case-critical part)
- **Remove Collaborator** with assigned tasks in that project -> return their assigned tasks so the frontend shows the **reassignment dialog**; each task reassigned to a remaining member OR left **unassigned** (allowed). Then remove membership; notify new assignees.
- **Deactivate PM** owning projects -> **mandatory per-project transfer**: each owned project reassigned to another PM (no "unassigned" for projects); **blocked** if no other PM exists (Owner counts as a valid target). The PM's `TaskAssignee` rows in *other* projects auto-unassign; notify those projects' PMs.

**Done when:** Admin can provision users (PM/Collaborator only; Owner adds Admins); PM can create/configure/archive/transfer projects; filtered views are correct per role; both reassignment flows work with their dialogs and the only-PM block holds; archived projects are read-only.

---

## Phase 5 — Tasks & the Board (Frontend 20%; the heart)

**Goal:** task data ops, then board UI, then detail panel.

### 5.1 Task API
```
GET    /projects/:id/tasks            # members only
POST   /projects/:id/tasks            # PM/Owner; title required; assignee optional
GET    /tasks/:id
PATCH  /tasks/:id                     # restricted fields -> PM/Owner only
DELETE /tasks/:id                     # PM/Owner only
PATCH  /tasks/:id/move                # column change; enforce PM-gating into Completed
POST   /tasks/:id/assignees           # assignee must be a project member
DELETE /tasks/:id/assignees/:userId
POST   /tasks/:id/checklist           # + PATCH/DELETE; toggle -> ActivityLog (no notification)
POST   /tasks/:id/labels
DELETE /tasks/:id/labels/:labelId
```
- **Restricted fields** (PM/Owner only): title, description, dueDate, priority, assignees, labels, moving into/out of the gated Completed column.
- **Progress fields** (assignees of the task + PM/Owner): status within non-gated columns, checklist toggles, comments, attachments.
- **Gating rule:** moving a task into or out of a column where `isPmGated=true` (Completed) is PM/Owner only — enforce server-side; the client also disables it.

### 5.2 Board UI
- Four-column Kanban (To Do / In Progress / Review / Completed) using **dnd-kit**.
- **Optimistic drag:** card moves instantly on drop; reconcile with server; on failure revert + error toast. No loading spinner during drag.
- Cards: labels, title, priority, due date, **stacked avatars** (image / initials-on-color fallback / `+N` overflow), **muted dashed-circle** for unassigned.
- For Collaborators: the Completed column is a **disabled drop zone** (lock icon + tooltip "Only the PM can complete tasks"); also enforced server-side.

### 5.3 Task detail panel
- Opens as a **right-side panel** over the board, deep-linkable (`/projects/:id/tasks/:taskId`).
- Sections in order: general info (title, description, status, priority, due date, assignees, labels) -> checklist (checkable, progress "n/m") -> attachments -> activity log; comment thread on the right.
- Enforce restricted vs progress field permissions in the UI (Collaborators see restricted fields read-only).

### 5.4 Labels & checklist
- Per-project labels: PM creates/edits the set; assignees+PM apply existing labels.
- Checklist: assignees+PM toggle; each toggle writes an `ActivityLog` entry (CHECKLIST_CHECKED/UNCHECKED), **no notification**.

**Done when:** PMs have full task control; Collaborators move only their assigned tasks among the non-gated columns and cannot reach Completed (UI + server); the board is fluid/optimistic; the detail panel shows all sections; restricted-field permissions hold server-side; unassigned and multi-assignee render correctly.

---

## Phase 6 — Collaboration: Comments, Attachments, Activity

```
GET  /tasks/:id/comments
POST /tasks/:id/comments              # parse @mentions -> CommentMention -> notify mentioned only
DELETE /comments/:id                  # own, or PM/Owner
GET  /tasks/:id/attachments
POST /tasks/:id/attachments           # validate MIME+size -> Supabase Storage (private) -> metadata+storageKey
DELETE /attachments/:id               # own, or PM/Owner
GET  /attachments/:id/url             # membership check -> short-lived SIGNED URL (buckets never public)
GET  /tasks/:id/activity              # append-only timeline
```
- **@mention picker** over project members; only mentions notify (plain comments do not).
- **Attachment storage key:** `attachments/{organizationId}/{projectId}/{taskId}/{attachmentId}-{filename}`. Download always via backend signed URL after a membership check.
- **Activity log** records: STATUS_CHANGED, ASSIGNED/UNASSIGNED, FIELD_CHANGED, CHECKLIST_CHECKED/UNCHECKED, ATTACHMENT_ADDED, COMMENT_ADDED. Append-only — never update/delete.

**Done when:** comments with working @mention notifications; attachments upload + download only for members via signed URLs (no public access); the activity timeline records exactly the locked event set.

---

## Phase 7 — Real-Time Notifications (Real-Time 10%; demo hero)

```
WS  Socket.IO gateway              # JWT-authenticated on connect; user joins room user:{userId}
GET   /notifications               # list (own only), unread filter
PATCH /notifications/:id/read
POST  /notifications/read-all
```
- **Auth on connect:** validate the JWT from the cookie; reject unauthenticated sockets; only then join the private room.
- **Persist-then-push:** write the Notification row first, then emit to user:{recipientId} if connected. Offline users fetch unread on reconnect (offline replay).
- **Triggers (only these):** TASK_ASSIGNED, STATUS_CHANGED, MENTION, DEADLINE (24h before + overdue), PROJECT_TRANSFERRED. Plain comments and checklist toggles do **not** notify.
- **Deadline job:** a scheduled task (cron) emits 24h/overdue notifications; **skips** tasks in the Completed column; **fires** for Review. Recipients: assignees + PM (PM only for unassigned tasks).
- **Frontend:** bell + unread badge + dropdown; live **toasts** for online events; full notifications page (read/unread, mark-all-read; clicking marks-one-read + navigates; opening dropdown does NOT auto-clear). Socket client reconnects with backoff.

**Done when:** a change in one session appears live in another with a toast; offline->online replays missed notifications; only the locked triggers fire; the deadline job respects the Completed-skip/Review-fire rule; bell + page + read-state behavior all work.

---

## Phase 8 — Dashboards, Search, Plans

```
GET /search?q=                     # title+description, scoped to caller's accessible projects ONLY
```
- **Dashboard (role-aware):** PM/Collaborator -> my tasks (across projects), due-soon, project progress bars; Admin -> org overview (user counts by role, pending invites, recent activity). One route `/dashboard`, content branches by role.
- **Search:** authorization-filtered — never returns tasks from projects the caller can't access.
- **Plans page:** static Free/Pro tiers; Pro features (custom columns, data export, etc.) marked "coming soon"; no payment, no enforcement on Free.

**Done when:** each role lands on the correct dashboard; search results are strictly access-scoped; the Plans page renders with the coming-soon treatment.

---

## Phase 9 — UI Polish: Responsive, Loading, Empty, Error

Apply the App Flow state catalog and Design Brief discipline to **every** screen.

- **Loading:** skeletons for content regions; inline spinners only on action buttons (disabled while loading); optimistic board (no spinner); the graceful **"Waking up the server…"** message if a fetch exceeds a few seconds (Render cold-start). **No full-page spinners.**
- **Empty states:** every list/board/dashboard, especially the **new-Owner empty org** (guided "create your first project", and the users-must-exist-before-invite guidance); each with one clear accent primary action — never a blank void.
- **Error states (full catalog):** failed login (generic message), expired temp password, invalid/expired verification link, duplicate email (field error), forbidden action (hidden/disabled + 401/403 backstop), network failure on load (toast + retry, keep content), network failure on action (optimistic rollback + toast, preserve input), validation errors (field-level, both layers), upload rejected (reason + limit), only-PM block (clear message), session expired (redirect + return). Backend returns structured errors (code/message/description).
- **Responsive:** sidebar->drawer (+ optional bottom tabs for top items), board scrolls horizontally, task panel -> full-screen overlay on mobile, tables -> stacked cards, touch targets >=44px, modals -> bottom-sheet.
- **Consistency pass:** confirm every screen is built from the same shadcn primitives + tokens (this is what delivers the hand-designed coherence) in **both light and dark**.

**Done when:** every screen handles empty/loading/error gracefully; works on mobile and desktop; reads as one coherent product in light and dark.

---

## Phase 10 — Testing (functional, per SRS)

- **Happy paths:** Owner signup->verify->project->task->board->complete; Admin onboarding->forced reset; Collaborator task lifecycle (move through non-gated columns, comment, attach, checklist).
- **Permission matrix:** for each role, attempt forbidden actions -> expect 401/403; cross-tenant -> 404. Explicitly test: Collaborator cannot complete a task, cannot edit restricted fields, cannot delete; Admin cannot see project contents; PM cannot see another PM's project.
- **Edge cases:** member-removal reassignment (incl. leave-unassigned), PM-deactivation per-project transfer, only-PM block, unassigned tasks, multi-assignee overflow, archived read-only, simultaneous real-time updates, offline replay, expired temp password + resend.
- **Validation:** both layers reject bad input; structured error shape correct.
- Record the test pass for the submission/README.

**Done when:** all core flows pass on the **deployed** environment; the permission matrix is fully verified; the listed edge cases behave exactly as specified.

---

## Phase 11 — Documentation & Final Deployment

- **Swagger/OpenAPI** via `@nestjs/swagger` decorators on all DTOs/controllers; UI live at a public path.
- **README:** overview, technologies (the exact stack), setup instructions, API usage (Swagger link), contribution notes. Must match the actual repo (no drift).
- **Diagrams:** ER (from the schema), class/architecture, deployment — per SRS deliverables.
- **Final config:** env vars set on Vercel/Render/Supabase; CORS locked to the production frontend; HTTPS/WSS confirmed; warm the backend (and optional keep-alive ping) before demoing.
- Confirm both public demo URLs work end-to-end.

**Done when:** Swagger is live and complete; README is accurate to the repo; diagrams delivered; both apps run at working public HTTPS URLs.

---

## Anti-Hallucination Checklist (the AI re-reads this each phase)

- [ ] Am I using **only** the approved stack/libraries (TRD)? No substitutions.
- [ ] Do all entities/fields match the **Backend Schema** exactly? No invented fields.
- [ ] Do all routes/screens/redirects match the **App Flow**? No invented screens.
- [ ] Do all colors/spacing/type come from **Design Brief tokens**? No hard-coded hex.
- [ ] Is every query **organization-scoped**? Is every protected route **guarded**?
- [ ] Does cross-tenant access return **404**, forbidden return **403**, unauth return **401**?
- [ ] Are tokens in **HTTP-only cookies** (never localStorage)?
- [ ] Is file access via **signed URLs** (never public buckets)?
- [ ] Did I avoid out-of-scope features (PRD "Out of Scope")?
- [ ] If something was unspecified, did I **STOP and ask** instead of guessing?

## Overall Done Criteria

Nuvela is finished when: all four roles work end-to-end with correct **server-enforced** permissions, on **mobile and desktop**, in **light and dark**; every SRS module is demonstrable live (auth/RBAC, user management, tasks/board, real-time incl. offline replay, security, deployment); real-time is provable in two side-by-side sessions; both apps are deployed at public HTTPS URLs with Swagger reachable; the repo is clean, modular, consistent; and every screen is on-brand and coherent — visibly one hand-designed product.

---

*This detailed manual, together with the PRD, TRD, App Flow, UI/UX Design Brief, and Backend Schema, is the complete and authoritative basis for implementation. Build strictly against these documents; when in doubt, ask rather than assume.*
