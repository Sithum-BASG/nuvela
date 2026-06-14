# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status: planning complete, pre-code

There is **no application code yet** — only the planning suite (`docs/`) and [PRODUCT.md](PRODUCT.md). See [CURRENT_STEP.md](CURRENT_STEP.md) for the live "where we are / do this next" pointer — this file stays phase-agnostic. Do not assume code, commands, or folders exist before verifying.

## Repository layout

Two **independent, decoupled** deployables under one repo (per Implementation Plan §0.1) — **no root workspace / no monorepo tooling.** Each app is fully self-contained with its own `package.json`, installed and built on its own; the root holds only shared repo files. This keeps free-tier deploys clean (Vercel builds `frontend/`, Render builds `backend/` from its Dockerfile) and matches the TRD's decoupled-architecture constraint. CI runs each app as its own job (per-app `working-directory`); there is no shared install step.

```
nuvela/                 # repo root
  frontend/             # Next.js client → Vercel
  backend/              # NestJS REST + WS gateway → Render (Dockerfile)
  docs/                 # the locked planning suite (+ superpowers/)
  build.ps1             # one-command full build/test runner (see Commands)
  AGENTS.md             # Codex/other agents → thin pointer to this file
  .cursor/rules/        # Cursor rules → thin pointer to this file
  README.md
  .gitignore
```

**This file is the single source of truth for agents.** `AGENTS.md` and `.cursor/rules/nuvela.mdc` are thin pointers back here — keep guidance in CLAUDE.md and don't fork it into them.

## The planning docs are binding — they are the source of truth

`docs/` holds six locked, authoritative documents. **Read the relevant one before working in its area; do not restate or fork their content here.** Each owns exactly one concern, and when two conflict, the doc that *owns* that concern wins:

| Doc | Owns |
|---|---|
| [01_Product_Requirements_Document.md](docs/01_Product_Requirements_Document.md) | Scope, roles, user stories, what's explicitly **out of scope** |
| [02_Technical_Requirements_Document.md](docs/02_Technical_Requirements_Document.md) | The locked stack, env vars, hard constraints |
| [03_App_Flow.md](docs/03_App_Flow.md) | Every route, redirect, and empty/error/loading state |
| [04_UI_UX_Design_Brief.md](docs/04_UI_UX_Design_Brief.md) | Color tokens, typography, spacing, component rules |
| [05_Backend_Schema.md](docs/05_Backend_Schema.md) | The Prisma data model (verbatim) + per-entity authorization matrix |
| [06_Implementation_Plan.md](docs/06_Implementation_Plan.md) | The phase-by-phase build order with binding done-criteria |

[07_Figma_Screens_Checklist.md](docs/07_Figma_Screens_Checklist.md) / [08_Figma_Reusable_Components_Checklist.md](docs/08_Figma_Reusable_Components_Checklist.md) are Figma checklists; [docs/superpowers/](docs/superpowers/) holds active design specs/plans.

**The cardinal rule** (from Implementation Plan §"How to use this document"): do **not** invent stack, fields, routes, screens, or defaults. If something is genuinely unspecified, **STOP and ask** — never substitute a "common" default or silently "improve" a locked decision.

## Scope discipline — do not over-engineer or hallucinate

These are the two failure modes to actively guard against. A clean, deliberate, human-judged repo is explicitly graded; over-engineering and invention both work against it.

**Don't over-engineer — build only what the current sub-step needs:**
- Smallest correct change. No speculative abstraction, generics, config flags, plugin systems, or "future-proofing" for anything outside the current sub-step.
- **No new dependencies** beyond the approved TRD list. If something seems to need one, STOP and ask — don't add it.
- No endpoints, fields, columns, options, or screens beyond what the docs specify. v2 / "Nice to Have" / Pro items are **out of scope** — never build toward them (the schema pre-models a few on purpose; don't add more).
- Prefer boring, standard, well-trodden patterns over clever ones; match the surrounding code. No premature optimization, caching, queues, or indirection the docs don't call for.

**Don't hallucinate — verify before you assert:**
- Never claim a file, function, route, env var, or command exists without checking it (read/grep/run first). The repo is pre-code — most things don't exist yet.
- Don't invent API shapes, DTO fields, library method signatures, or config. Take data-model/route/token facts from the **owning doc**; take library APIs from the **installed package**, not memory — if unsure, look it up.
- Never fabricate command output, test results, or a "done" status. Run the real thing and show real output.
- Docs silent on something = **STOP and ask**, not a license to fill the gap with a plausible default.

Re-read doc 06's Anti-Hallucination Checklist at the start of each phase.

## What to keep in mind everywhere (details live in the docs)

- **Decoupled, two deployables:** `/frontend` (Next.js client, Vercel) and `/backend` (NestJS REST + WS gateway, Render) are independent and never collapsed. PostgreSQL + private Storage on Supabase; Resend for email. TypeScript everywhere; no server business logic in the frontend. → see [TRD](docs/02_Technical_Requirements_Document.md).
- **Cross-cutting invariants** are graded SRS requirements — enforce them in every phase, never retrofit: multi-tenant `organizationId` scoping; self-rolled JWT in **HTTP-only cookies**; 401/403/404 RBAC (404 hides cross-tenant existence); PM-gated Completed column; signed-URL file access (buckets never public); persist-then-push notifications; no hard deletes; validation at both layers. → details + the authorization matrix in [Backend Schema](docs/05_Backend_Schema.md).
- **Design system by construction:** every screen from the same shadcn/ui primitives + Design Brief tokens; never hard-code hex; light/dark both first-class; Sora (display) + Roboto (UI/body). → see [Design Brief](docs/04_UI_UX_Design_Brief.md).
- **The frontend is built FROM the Figma file (the visual source of truth) via the Figma MCP — do not invent UI.** Before building any screen/component, pull its design context from Figma (`get_design_context`, `get_variable_defs`, `get_screenshot`, and `get_code_connect_map` where mappings exist) and match it: layout, spacing, component choice, and states. The Figma design system already holds the tokens/components ([docs 07](docs/07_Figma_Screens_Checklist.md)/[08](docs/08_Figma_Reusable_Components_Checklist.md) inventory). **Gap-fill rule:** if a screen or state is genuinely missing from Figma, do not freestyle a new visual language — compose it from existing Figma components + Design Brief tokens + the App Flow's required states, keep it consistent with neighboring screens, and **flag the gap** (note it in the PR / `CURRENT_STEP.md`) so it can be added to Figma later. When Figma and a doc conflict on *visuals*, Figma wins; on *behavior/data/routes*, the owning doc wins. Figma file + node map: see the roadmap's "UI source of truth" section.
- **Build order is sequenced against the SRS rubric** (deploy skeleton early, auth before features). Don't start a phase whose prerequisites aren't met, or build UI for an API that doesn't exist yet. Re-read the Anti-Hallucination Checklist at the end of [doc 06](docs/06_Implementation_Plan.md) each phase. The elaborated, executable pathway lives in [docs/superpowers/plans/2026-06-14-nuvela-build-roadmap.md](docs/superpowers/plans/2026-06-14-nuvela-build-roadmap.md) — the master index that decomposes every phase into branch-sized sub-steps and links each phase's detailed plan.
- **Phase-boundary rule (mandatory):** when a phase's done-gate passes, before starting the next phase, **generate that next phase's detailed plan** (`docs/superpowers/plans/2026-06-14-phase-N-<name>.md`) using the **`superpowers:writing-plans`** skill — written fresh against the code that now exists, following the roadmap's decomposition. Only Phase 0's plan is pre-written; every later phase plan is produced just-in-time at its boundary, never skipped.

## Commands (intended — won't work until scaffolded per Phase 0; verify first)

**Dev environment is Windows + PowerShell** — use PowerShell syntax (`$env:VAR`, `;` / `&&`, backslash paths), not bash assumptions.

- Backend (`backend/`): `npm run start:dev`
- Frontend (`frontend/`): `npm run dev`
- Prisma (from `backend/`): `npx prisma migrate dev --name <name>`, `npx prisma studio`, seed via `prisma/seed.ts` (`DATABASE_URL` pooled for runtime, `DIRECT_URL` direct for migrations)
- Add `lint` / `typecheck` / `test` here as each app gains them. **Verify done-criteria by running the relevant command or flow — never assert "done" without observed output.**

**Full build (one command):** `./build.ps1` runs `lint → typecheck → test → build` for `backend/` then `frontend/`. It skips any app or npm script that doesn't exist yet, so it's safe to run at any stage and grows automatically as each app gains those scripts (so name them `lint`/`typecheck`/`test`/`build` in each `package.json`). Flags: `-Install` (run `npm ci` first), `-SkipTest` (build only). It fails fast on the first non-zero exit.

## Git workflow (every sub-step ships to GitHub)

> Prerequisite: `git init` + a GitHub remote with a protected `main` is Phase 0.1 — this workflow only starts once that exists.

The unit of work is **one sub-step** of the Implementation Plan (e.g. 3.2); the plan will be refined further to make sub-steps granular. Each completed sub-step is committed and pushed — work is never left only on disk.

- **Never commit to `main` directly** (protected). One sub-step = one branch → PR into `main`. Branch names: `feat/<area>`, `fix/<area>`, `chore/<area>`, `docs/<area>`.
- Keep commits scoped with imperative subjects (e.g. `feat(auth): add JWT refresh rotation`); no catch-all "wip"/"updates" messages.
- Push after finishing the sub-step (including its `CURRENT_STEP.md` update). Never commit secrets or `.env`.
- Confirm with the user before merging a PR unless they've said to self-merge.

## Step handoff doc — `CURRENT_STEP.md`

A single `CURRENT_STEP.md` at the repo root always describes **the next sub-step to implement**, written so a fresh agent with no prior context can execute it cold. Update it as the **last action of every sub-step**, before the final push.

It must contain:
- **Where we are** — current phase/sub-step (per [doc 06](docs/06_Implementation_Plan.md)) and what was just completed.
- **The next sub-step** — its goal, the exact files/endpoints/screens to touch, and the relevant doc sections to read first (link them — don't restate them).
- **Constraints in play** — which cross-cutting invariants apply (e.g. org-scoping, PM-gating, HTTP-only cookies).
- **Done-criteria** — copied/derived from the phase's done-criteria; "it compiles" is not done.
- **Branch name** to use for the sub-step.

Keep it short and current — it's a pointer + handoff, not a second copy of the docs. The detailed, longer-lived plans live in [docs/superpowers/plans/](docs/superpowers/); `CURRENT_STEP.md` is the always-fresh "do this next" view.

## Testing

Automated tests are written **per phase, to satisfy that phase's done-criteria** — not for every sub-step. Sub-steps are verified by running the app/flow; the phase boundary is where tests land.

- **Mandatory automated coverage** for the security-graded, silently-breakable invariants: auth flows and the **RBAC permission matrix** (Phases 3–5) — per role, forbidden actions return 401/403 and cross-tenant returns 404. These are the highest-value tests in the project.
- Routine CRUD/UI sub-steps lean on manual verification + phase done-criteria; add focused tests where logic is non-trivial (reassignment/transfer flows, the deadline-job skip rules).
- Phase 10 is a final consolidation/regression pass, not the first time tests appear.

## Working conventions

- The four board columns are seeded by a **single reusable function** shared by the seed and project creation (To Do 0, In Progress 1, Review 2, Completed 3 with `isCompletedColumn` + `isPmGated`).
- Write `@nestjs/swagger` decorators on DTOs/controllers **as each endpoint is built**, not deferred to Phase 11 — incremental is near-free, retrofitting is not.
- Cite non-obvious choices in code comments by source (e.g. `// HTTP-only cookie per TRD auth section`).
