# Current Step

**Where we are:** Phase 0 (Foundations). Just completed: repo init + structure (Task 0.1).

**Next sub-step:** Task 0.2 — Backend init (`chore/backend-init`).
- Goal: scaffold NestJS in `backend/` with the exact TRD dependency set and the MVC module skeleton.
- Read first: [docs/06_Implementation_Plan.md §0.2](docs/06_Implementation_Plan.md), [docs/02_Technical_Requirements_Document.md §Backend](docs/02_Technical_Requirements_Document.md).
- Plan: [docs/superpowers/plans/2026-06-14-phase-0-foundations.md](docs/superpowers/plans/2026-06-14-phase-0-foundations.md) Task 0.2.

**Constraints in play:** no new deps beyond the TRD list; MVC/modular structure; TypeScript everywhere.

**Done-criteria:** `cd backend; npm run start:dev` runs; module skeleton matches the spec tree; `npm run typecheck` and `npm run build` pass.

**Branch:** `chore/backend-init`
