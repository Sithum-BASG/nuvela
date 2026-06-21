# Nuvela

A calm, multi-tenant, role-based Kanban task-management workspace.

- **Frontend:** Next.js (TypeScript) — `frontend/` → Vercel
- **Backend:** NestJS (TypeScript) — `backend/` → Render
- **Data:** PostgreSQL + Storage on Supabase · Email via Resend

## Testing

From the repo root:

```powershell
./build.ps1
```

Runs `lint → typecheck → test → build` for `backend/` then `frontend/`. Backend includes **131 unit tests** and **phase e2e suites** (`auth`, RBAC matrices, collaboration, notifications, dashboard/search, Phase 10 happy-path/edge/validation). E2e tests that hit the database require `DATABASE_URL` (same as local dev).

Phase 10 coverage highlights:

- **Happy path:** owner signup → verify → project → task → Completed (`phase10-happy-paths.e2e-spec.ts`)
- **Admin onboarding:** forced password reset (`auth.e2e-spec.ts`)
- **Permission matrix:** role guards (`phase4/5` e2e) + service-level 401/403/404 (`*.service.spec.ts`)
- **Edge cases:** member removal with leave-unassigned, archived read-only, PM deactivation transfer, PM-gated Completed, deadline/unassigned notifications
- **Validation:** structured `{ statusCode, code, message }` errors (`http-exception.filter.spec.ts`, `phase10-validation.e2e-spec.ts`)

### Deployed smoke checklist (manual)

After deploy, verify on production URLs (light + dark, desktop + mobile):

- [ ] Owner signup → verify → login → create project → task → complete
- [ ] Admin invite → temp password → forced reset → users list
- [ ] Collaborator: board move (non-Completed), comment, checklist toggle
- [ ] Cross-role forbidden actions return correct UI + API codes
- [ ] Notifications: live toast + unread replay after refresh
- [ ] Search scoped to accessible projects only

Setup instructions, stack details, and the Swagger link land in Phase 11.
