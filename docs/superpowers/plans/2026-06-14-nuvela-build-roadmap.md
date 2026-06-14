# Nuvela Build Roadmap (master pathway)

> **For agentic workers:** This is the start-to-finish pathway, not an executable task list. Each phase below links to (or will get) its own **detailed bite-sized plan** in this folder. To *implement* a phase, open its phase plan and use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Steps in the phase plans use checkbox (`- [ ]`) syntax.

**Goal:** Build Nuvela — a multi-tenant, role-based Kanban task manager — end to end, from empty repo to two deployed HTTPS apps with real-time, exactly per the locked planning docs.

**Architecture:** Two decoupled deployables in one repo (no monorepo tooling): `frontend/` (Next.js → Vercel) and `backend/` (NestJS REST + Socket.IO → Render), with PostgreSQL + Storage on Supabase and Resend for email. Build order is sequenced against the SRS rubric: deploy a skeleton early, auth before features, real-time and polish last.

**Tech Stack:** Next.js + Tailwind + shadcn/ui + dnd-kit + TanStack Query + Zod/RHF; NestJS + Prisma + Passport-JWT + Socket.IO + bcrypt + class-validator + @nestjs/throttler; Supabase; Resend. TypeScript everywhere.

**Source of truth:** the six locked docs in [`docs/`](../../). This roadmap *sequences and decomposes* them; it does not restate or override them. The phase goals and done-gates below are drawn from [doc 06](../../06_Implementation_Plan.md) — when in doubt, that doc and its peers win.

---

## How to use this roadmap

1. **One sub-step = one branch = one PR** (per [CLAUDE.md](../../../CLAUDE.md) Git workflow). The sub-steps listed per phase below are those branch units.
2. **Phase-boundary rule (mandatory):** the moment a phase's done-gate passes — before starting the next phase — generate that next phase's detailed plan (`2026-06-14-phase-N-<name>.md`) using the **`superpowers:writing-plans`** skill, fresh against the code that now exists and following this roadmap's decomposition for that phase. Never start a phase without its detailed plan; never skip this step. Phase 0's plan is the only one pre-written.
3. **`CURRENT_STEP.md`** at the repo root always points at the next sub-step; update it as the last action of each sub-step.
4. **Gate-in / Gate-out:** do not start a phase until its gate-in (the prior phase's done-gate) is verifiably true. "It compiles" is not done — verify by running.
5. **Tests** land at the **phase boundary** to satisfy the done-gate, with mandatory automated coverage for auth/RBAC (Phases 3–5). Routine sub-steps are verified by running the app/flow.
6. **`./build.ps1`** must stay green at every phase boundary.

## UI source of truth — Figma (read via MCP)

**All frontend UI is implemented from the Figma file via the Figma MCP — agents do not invent UI.** The Figma file already contains the design system (color/spacing/radius/typography variables, and the component + screen inventories in [docs 07](../../07_Figma_Screens_Checklist.md)/[08](../../08_Figma_Reusable_Components_Checklist.md)).

- **Figma file:** `<RECORD FIGMA FILE URL/KEY HERE>` — **ask the user for the Figma file URL the first time it's needed (Phase 0 Task 0.4, wiring tokens), then record it here.** Do not proceed with frontend work without it; never invent a file key. Known node refs so far: design-system page `175:2`, Auth Card component set `803:2893` (Light `803:2868` / Dark `803:2878`).
- **Per-screen workflow (design → code):** before building a screen/component, (1) `get_metadata` / `get_design_context` for the target frame to get structure, layout, spacing, and component usage; (2) `get_variable_defs` to read the exact token values it binds; (3) `get_screenshot` to verify your build matches; (4) `get_code_connect_map` if a Figma→code mapping exists for a component, and reuse the mapped code component. Read-direction tools only here; this is not `use_figma`.
- **Match, don't reinvent:** reproduce the Figma frame's layout, spacing, component choices, and both light/dark states. Coded tokens (Phase 0.4) must equal the Figma variables — Figma is authoritative where the Design Brief is silent (e.g. dark-mode `accent-tint`).
- **Gap-fill rule:** if a screen/state the App Flow requires is missing from Figma, do **not** freestyle — compose it from existing Figma components + Design Brief tokens + the required App Flow states, keep it consistent with neighboring screens, and **flag the gap** in the PR and `CURRENT_STEP.md` (so it can be added to Figma later). Optionally, the gap may be pushed back into Figma with `use_figma` (load the `figma-use` skill first) — but only with user direction.
- **Conflict rule:** Figma wins on *visuals*; the owning doc wins on *behavior/data/routes/permissions*.

Every frontend-touching phase below (3, 4, 5, 8, 9 — and tokens in 0) carries a **UI:** line pointing back to this workflow.

## Dependency graph

```
P0 Foundations
   └─> P1 Database ─┐
   └─> P2 Deploy ───┤   (P1 and P2 can interleave once P0 is done)
                    └─> P3 Auth & RBAC  (the gate for ALL features)
                            └─> P4 Orgs / Users / Projects
                                    └─> P5 Tasks & Board
                                            ├─> P6 Comments / Attachments / Activity
                                            │       └─> P7 Real-time Notifications
                                            └─> P8 Dashboards / Search / Plans
                                                    └─> P9 UI Polish (all screens)
                                                            └─> P10 Testing pass
                                                                    └─> P11 Docs & final deploy
```

Hard rule: **no feature work (P4+) begins until P3's done-gate passes.** Never build UI for an API that doesn't exist yet.

---

## Phase 0 — Foundations, Repo, Tokens

**Gate-in:** none (start here). **Goal:** a clean, themed, runnable skeleton for both deployables.
**Detailed plan:** [2026-06-14-phase-0-foundations.md](2026-06-14-phase-0-foundations.md) ✅ written.

**Sub-steps (branch units):**
- `chore/repo-init` — git init, GitHub remote, protected `main`, structure (`frontend/ backend/ docs/`), `.gitignore`, README skeleton, seed `CURRENT_STEP.md`.
- `chore/backend-init` — `nest new`, install the exact backend dep set, MVC module skeleton.
- `chore/frontend-init` — `create-next-app`, `shadcn init`, install the exact frontend dep set, folder skeleton.
- `feat/design-tokens` — wire Design Brief tokens into Tailwind + shadcn CSS vars (`:root` + `.dark`), Sora/Roboto via `next/font/google`, theme provider + toggle; prove a Button renders in light **and** dark from tokens.
- `chore/env-example` — `.env.example` with every TRD variable.
- `chore/backend-dockerfile` — multi-stage Dockerfile; verify it builds.

**UI:** the token values must equal the Figma variables — pull `get_variable_defs` and reconcile (Figma authoritative where the Design Brief is silent). See "UI source of truth" above.
**Invariants introduced:** token-only styling (no hard-coded hex); two-folder decoupled layout; secrets never committed.
**Done-gate (doc 06 §0):** both dev servers run locally; frontend renders a shadcn Button in light+dark via tokens; structure matches the spec exactly; `.env.example` complete; Dockerfile builds; `./build.ps1` green.

---

## Phase 1 — Database & Migrations

**Gate-in:** P0 done. **Goal:** the full relational model live in Supabase, with seed data.
**Detailed plan:** generate `2026-06-14-phase-1-database.md` before starting.

**Sub-steps:**
- `feat/prisma-schema` — copy the Backend Schema Prisma file **verbatim** into `backend/prisma/schema.prisma`; configure `url`/`directUrl`.
- `feat/prisma-migrate` — `prisma migrate dev --name init` against Supabase; create `PrismaService` + module; verify all 16 tables / 6 enums / `@@unique` constraints in Studio.
- `feat/column-seed-fn` — the single reusable four-column seeding function (To Do/In Progress/Review/Completed, last one `isCompletedColumn`+`isPmGated`).
- `feat/db-seed` — `prisma/seed.ts`: 1 org, Owner, Admin, 2 PMs, 3 Collaborators, 2 projects (seeded columns), ~8 tasks (mixed columns/priorities/assignment), labels, checklist items, memberships.

**Invariants:** all access via Prisma (no raw SQL); columns only ever created by the shared seed function.
**Done-gate (doc 06 §1):** migration applies cleanly to Supabase; seed runs; Studio shows the full graph; the column-seed function is the single source of column creation.
**Source:** [05_Backend_Schema.md](../../05_Backend_Schema.md).

---

## Phase 2 — Deploy Skeleton Early (DevOps 20%)

**Gate-in:** P0 done (P1 may run in parallel). **Goal:** empty-but-running apps live at public HTTPS URLs, CI green.
**Detailed plan:** generate `2026-06-14-phase-2-deploy.md`.

**Sub-steps:**
- `feat/health-endpoint` — `GET /health` → `{status:'ok'}`.
- `chore/deploy-backend-render` — deploy backend Dockerfile to Render (WebSocket-enabled); env vars set; `/health` reachable over HTTPS.
- `chore/deploy-frontend-vercel` — connect repo to Vercel (root `frontend/`); env vars; themed skeleton renders over HTTPS.
- `feat/cors-and-api-client` — backend CORS allows exact `FRONTEND_URL` with `credentials:true` (never `*`); frontend API client hits `/health` cross-origin successfully.
- `chore/supabase-bucket` — confirm DB reachable from deployed backend; create **private** `attachments` bucket.
- `chore/ci-actions` — GitHub Actions: on PR, lint + typecheck + build both apps (call `build.ps1` or per-app jobs).

**Invariants:** HTTPS/WSS only; CORS credentials locked to the frontend origin; buckets private.
**Done-gate (doc 06 §2):** both apps live at HTTPS; deployed frontend calls deployed backend `/health` cross-origin; CI passes on a PR; private `attachments` bucket exists.

---

## Phase 3 — Authentication & RBAC (Security 15%) — the gate for all features

**Gate-in:** P1 + P2 done. **Goal:** full auth backbone, four roles, multi-tenant guards — before any feature.
**Detailed plan:** generate `2026-06-14-phase-3-auth-rbac.md`. **Tests mandatory** (see below).

**Sub-steps:**
- `feat/password-and-tokens` — bcrypt helper (cost ≥10); access+refresh JWT (payload `{userId, role, organizationId}`, two secrets); HTTP-only `Secure`/`SameSite=None` cookies via `cookie-parser`; `RefreshToken` rotation + revocation (hashed).
- `feat/guards-decorators` — `JwtAuthGuard` (401), `RolesGuard`+`@Roles` (403), `@CurrentUser()`, tenant-scoping helper (cross-tenant → 404).
- `feat/auth-endpoints` — the 8 endpoints exactly: signup, verify-email, login, refresh, logout, first-login/reset-password, forgot-password, reset-password.
- `feat/onboarding-mechanics` — Owner signup→verify email (Resend); Admin-created temp password (`mustResetPassword`, 72h expiry) + forced reset; resend-invite; throttler on auth endpoints.
- `feat/frontend-auth-screens` — the 7 auth screens + auth provider + protected routes + redirect logic **exactly per the App Flow redirect table**; silent refresh; session-expired → `/login`.

**UI:** build the 7 auth screens from their Figma frames via MCP (Auth Card set `803:2893` etc.) — don't invent layouts. Gap-fill per the Figma workflow above.
**Invariants (all of them light up here):** HTTP-only cookies (never localStorage); 401/403/404 semantics; org-scoping on every query; rate-limited auth.
**Tests (mandatory):** all four roles authenticate; tokens in cookies not localStorage; forbidden → 401/403; cross-tenant → 404; Owner signup→verify→dashboard; Admin-create→temp-pw→forced-reset; refresh + logout revocation.
**Done-gate (doc 06 §3):** the above verified on the **deployed** env.
**Source:** [02_TRD §Auth](../../02_Technical_Requirements_Document.md), [05 §Authorization](../../05_Backend_Schema.md), [03 §Auth Flow](../../03_App_Flow.md).

---

## Phase 4 — Organizations, Users & Projects

**Gate-in:** P3 done. **Goal:** the structural entities in dependency order.
**Detailed plan:** generate `2026-06-14-phase-4-orgs-users-projects.md`. **RBAC tests mandatory.**

**Sub-steps:**
- `feat/users-api` — `GET/POST /users`, `PATCH /users/:id`, deactivate, resend-invite (Admin/Owner; Admins can't create Admins).
- `feat/org-admin-api` — Owner-only `POST/DELETE /organization/admins`, `PATCH /organization`.
- `feat/users-ui` — user-management table + create/edit-user modals + Admin dashboard overview.
- `feat/projects-api` — `GET/POST /projects`, `GET/PATCH /projects/:id`, archive/unarchive, transfer (PM/Owner; create seeds 4 columns via the shared fn; cross-tenant/other-PM → 404).
- `feat/projects-ui` — filtered project list per role, create-project, project settings (General/Members/Labels/Danger Zone), archived list.
- `feat/membership-api` — `GET/POST/DELETE /projects/:id/members` + minimal org user directory for invites.
- `feat/reassignment-flows` — remove-Collaborator reassignment dialog (reassign or leave-unassigned); deactivate-PM mandatory per-project transfer + only-PM block + auto-unassign elsewhere with notify.

**UI:** build the user-management table, modals, project list/settings, and the reassignment/transfer dialogs from their Figma frames via MCP — don't invent. Gap-fill per the Figma workflow above.
**Invariants:** soft deactivate/archive (no hard delete); membership gates project visibility; one non-null `managerId` per project.
**Tests:** role permission matrix for users/projects; Admin can't see project contents; PM can't see another PM's project (404); both reassignment flows incl. only-PM block.
**Done-gate (doc 06 §4):** provisioning, project CRUD/archive/transfer, filtered views, both reassignment flows, archived read-only — all correct.

---

## Phase 5 — Tasks & the Board (Frontend 20%) — the heart

**Gate-in:** P4 done. **Goal:** task data ops → board UI → detail panel.
**Detailed plan:** generate `2026-06-14-phase-5-tasks-board.md`. **Gating/permission tests mandatory.**

**Sub-steps:**
- `feat/tasks-api` — `GET/POST /projects/:id/tasks`, `GET/PATCH/DELETE /tasks/:id`, `PATCH /tasks/:id/move` (PM-gating into/out of Completed), assignees add/remove (assignee must be member), checklist CRUD (toggle → ActivityLog, no notify), labels add/remove.
- `feat/board-ui` — four-column dnd-kit board; optimistic drag (instant move, revert+toast on failure); cards with labels/title/priority/due/stacked avatars/unassigned placeholder.
- `feat/board-completed-lock` — Completed is a disabled drop zone for Collaborators (lock icon + tooltip), enforced server-side too.
- `feat/task-detail-panel` — right-side deep-linkable panel (`/projects/:id/tasks/:taskId`): general info → checklist (n/m) → attachments → activity; comment thread; restricted vs progress fields enforced in UI.
- `feat/labels-checklist` — per-project label management (PM) + apply (assignees/PM); checklist toggles write ActivityLog.

**UI:** build the board, columns, task card (all states: default/dragging/unassigned/locked), and the task detail panel from their Figma frames via MCP — match spacing, card layout, and the Completed-lock treatment exactly. Gap-fill per the Figma workflow above.
**Invariants:** restricted fields (title/desc/due/priority/assignees/labels/gated-move) = PM/Owner; progress fields (status in non-gated columns, checklist) = assignees+PM; gating enforced server-side.
**Tests:** Collaborator cannot reach Completed (UI + server) or edit restricted fields or delete; optimistic rollback; unassigned + multi-assignee render.
**Done-gate (doc 06 §5).**

---

## Phase 6 — Collaboration: Comments, Attachments, Activity

**Gate-in:** P5 done. **Goal:** comments w/ mentions, signed-URL attachments, activity timeline.
**Detailed plan:** generate `2026-06-14-phase-6-collaboration.md`.

**Sub-steps:**
- `feat/comments-api` — `GET/POST /tasks/:id/comments` (parse @mentions → CommentMention → notify mentioned only), `DELETE /comments/:id` (own or PM/Owner).
- `feat/comments-ui` — chat-style thread + @mention picker over project members.
- `feat/attachments-api` — upload (validate MIME+size → private Supabase Storage at `attachments/{org}/{project}/{task}/{id}-{file}` → metadata+storageKey), `DELETE`, `GET /attachments/:id/url` (membership check → short-lived signed URL).
- `feat/attachments-ui` — uploader + progress + download row (always via signed URL).
- `feat/activity-log` — append-only timeline recording the locked event set; never update/delete.

**Invariants:** buckets never public; downloads always backend-mediated signed URLs; only @mentions notify (plain comments/checklist don't); activity log append-only.
**Done-gate (doc 06 §6).**

---

## Phase 7 — Real-Time Notifications (Real-Time 10%) — demo hero

**Gate-in:** P6 done (needs the notification triggers from P4–P6 wired). **Goal:** persist-then-push real-time.
**Detailed plan:** generate `2026-06-14-phase-7-realtime.md`.

**Sub-steps:**
- `feat/socket-gateway` — Socket.IO gateway, JWT-authenticated on connect (reject unauth), user joins `user:{userId}` room.
- `feat/notifications-api` — `GET /notifications` (own, unread filter), `PATCH /notifications/:id/read`, `POST /notifications/read-all`.
- `feat/persist-then-push` — write Notification row first, then emit if online; offline replay on reconnect; wire the five triggers only (TASK_ASSIGNED, STATUS_CHANGED, MENTION, DEADLINE, PROJECT_TRANSFERRED).
- `feat/deadline-job` — cron emits 24h-before + overdue; **skips** Completed, **fires** for Review; recipients = assignees + PM (PM only when unassigned).
- `feat/notifications-ui` — bell + unread badge + dropdown; live toasts; full notifications page (mark-all-read; click marks-one + navigates; opening dropdown does NOT auto-clear); reconnect with backoff.

**Invariants:** persist-then-push; only the five triggers; deadline skip/fire rule; socket auth before room join.
**Tests:** two side-by-side sessions see live updates + toast; offline→online replay; only locked triggers fire.
**Done-gate (doc 06 §7).**

---

## Phase 8 — Dashboards, Search, Plans

**Gate-in:** P5 done (P7 not required). **Goal:** role-aware dashboards, scoped search, static Plans.
**Detailed plan:** generate `2026-06-14-phase-8-dashboards-search-plans.md`.

**Sub-steps:**
- `feat/dashboard` — one `/dashboard` route branching by role: PM/Collaborator (my tasks across projects, due-soon, project progress); Admin (org overview).
- `feat/search-api-ui` — `GET /search?q=` over title+description, **strictly access-scoped**; global search field + results page.
- `feat/plans-page` — static Free/Pro tiers, Pro "coming soon", no payment/enforcement.

**UI:** build the role-aware dashboard variants, search results, and Plans page from their Figma frames via MCP — don't invent. Gap-fill per the Figma workflow above.
**Invariants:** search never returns inaccessible tasks; no paid-tier enforcement.
**Done-gate (doc 06 §8).**

---

## Phase 9 — UI Polish: Responsive, Loading, Empty, Error

**Gate-in:** P8 done (applies across all built screens). **Goal:** every screen handles empty/loading/error, responsive, light+dark.
**Detailed plan:** generate `2026-06-14-phase-9-polish.md`.

**UI:** prefer the Figma frames for empty/loading/error/responsive states where they exist (docs 07 lists many as cross-cutting states); this phase is where the **gap-fill rule** is exercised most — compose any missing state from existing Figma components + Design Brief tokens and flag it. Verify against `get_screenshot`.
**Sub-steps:** `feat/loading-states`, `feat/empty-states`, `feat/error-states`, `feat/responsive`, `chore/consistency-pass` — each applying the full App Flow state catalog + Design Brief discipline (skeletons not full-page spinners; inline button spinners; optimistic board; "Waking up the server…" cold-start; structured backend errors; sidebar→drawer, board horizontal scroll, panel→full-screen, tables→cards, ≥44px targets, modals→bottom-sheet).
**Done-gate (doc 06 §9):** every screen graceful in empty/loading/error, mobile+desktop, light+dark — one coherent product.
**Source:** [03_App_Flow.md](../../03_App_Flow.md) state catalog, [04_UI_UX_Design_Brief.md](../../04_UI_UX_Design_Brief.md).

---

## Phase 10 — Testing (functional, per SRS)

**Gate-in:** P9 done. **Goal:** consolidate + regression; full permission matrix + edge cases on the deployed env.
**Detailed plan:** generate `2026-06-14-phase-10-testing.md`.

**Sub-steps:** `test/happy-paths`, `test/permission-matrix` (every role × forbidden action → 401/403; cross-tenant → 404), `test/edge-cases` (reassignment incl. leave-unassigned, PM-deactivation transfer, only-PM block, unassigned/multi-assignee, archived read-only, simultaneous real-time, offline replay, expired temp-pw+resend), `test/validation` (both layers + structured error shape). Record the pass for the README.
**Done-gate (doc 06 §10):** all core flows pass on **deployed**; permission matrix fully verified; edge cases behave as specified.

---

## Phase 11 — Documentation & Final Deployment

**Gate-in:** P10 done. **Goal:** Swagger live, accurate README, diagrams, final config, working demo URLs.
**Detailed plan:** generate `2026-06-14-phase-11-docs-deploy.md`.

**Sub-steps:** `docs/swagger` (verify `@nestjs/swagger` complete + UI public — note: decorators were written incrementally), `docs/readme` (overview, exact stack, setup, Swagger link), `docs/diagrams` (ER + architecture + deployment), `chore/final-config` (env on all platforms, CORS locked to prod frontend, HTTPS/WSS, warm-up/keep-alive), `chore/demo-verify` (both public URLs end-to-end).
**Done-gate (doc 06 §11).**

---

## Overall done criteria (doc 06)

Nuvela is finished when all four roles work end-to-end with **server-enforced** permissions, on mobile+desktop, in light+dark; every SRS module is demonstrable live (auth/RBAC, user management, tasks/board, real-time incl. offline replay, security, deployment); real-time is provable in two side-by-side sessions; both apps are deployed at public HTTPS URLs with Swagger reachable; the repo is clean, modular, consistent; every screen is on-brand — visibly one hand-designed product.
