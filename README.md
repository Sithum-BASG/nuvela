# Nuvela

A calm, multi-tenant, role-based Kanban task-management workspace built for INTE 21323.

**Live demo**

| App | URL |
|---|---|
| Frontend | https://nuvela.vercel.app |
| Backend API | https://nuvela.onrender.com |
| Swagger UI | https://nuvela.onrender.com/api |
| Health check | https://nuvela.onrender.com/health |

## Overview

Nuvela is a decoupled full-stack app: a Next.js client on Vercel talks to a NestJS REST + WebSocket API on Render. Data lives in Supabase (PostgreSQL + private Storage); transactional email uses Resend. Auth is self-rolled JWT in **HTTP-only cookies** with org-scoped RBAC (Owner, Admin, Project Manager, Collaborator).

## Tech stack (locked TRD)

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (TypeScript, App Router), Tailwind, shadcn/ui, TanStack Query, React Hook Form + Zod, dnd-kit, socket.io-client, date-fns |
| Backend | NestJS 11, Prisma 6, Passport JWT, class-validator, Socket.IO, `@nestjs/swagger`, `@nestjs/throttler` |
| Database | PostgreSQL on Supabase |
| File storage | Supabase Storage (private buckets, signed URLs) |
| Email | Resend |
| Hosting | Vercel (frontend), Render (backend Docker) |
| CI | GitHub Actions (`ci.yml`) |

## Repository layout

```
nuvela/
  frontend/     # Next.js client
  backend/      # NestJS API + WebSocket gateway
  diagrams/     # ER, architecture, deployment (Mermaid)
  build.ps1     # lint → typecheck → test → build (both apps)
```

Planning docs live in `docs/` (local/gitignored in this clone).

## Local setup

### Prerequisites

- Node.js 20+
- npm
- Supabase project (Postgres + Storage) or local Postgres with `DATABASE_URL` / `DIRECT_URL`

### Environment

Copy `.env.example` values into:

- `backend/.env` — all server secrets (`DATABASE_URL`, `DIRECT_URL`, JWT secrets, Supabase, Resend, `FRONTEND_URL`, `BACKEND_URL`)
- `frontend/.env.local` — `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`

Never commit `.env` files.

### Backend

```powershell
cd backend
npm ci
npx prisma migrate dev
npx prisma db seed          # optional demo data
npm run start:dev           # http://localhost:3001
```

Swagger UI (local): http://localhost:3001/api

### Frontend

```powershell
cd frontend
npm ci
npm run dev                 # http://localhost:3000
```

### Full verify

```powershell
./build.ps1
cd backend; npm run test:e2e
```

## API usage

- **Base URL:** `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL`
- **Auth:** `POST /auth/login` sets `access_token` and `refresh_token` HTTP-only cookies. Send cookies on subsequent requests (`credentials: 'include'` in the browser).
- **Refresh:** `POST /auth/refresh` rotates tokens.
- **Errors:** `{ statusCode, code, message }` JSON (see Swagger for per-endpoint codes).
- **Interactive docs:** [Swagger UI](https://nuvela.onrender.com/api) — use cookie auth after logging in via the app or `/auth/login` in another tab.

## Diagrams

Mermaid sources in [`diagrams/`](diagrams/):

- [`er-diagram.mmd`](diagrams/er-diagram.mmd) — entity relationships (from Prisma schema)
- [`architecture.mmd`](diagrams/architecture.mmd) — system components
- [`deployment.mmd`](diagrams/deployment.mmd) — CI/CD and hosting

Render in GitHub or any Mermaid viewer.

## Testing

```powershell
./build.ps1
```

Backend: **131** unit tests + **71** e2e tests across auth, RBAC, tasks, collaboration, notifications, dashboard/search, and Phase 10 regression suites. See README testing section history in git for the deployed smoke checklist.

## Deployment notes

- **Render** builds `backend/Dockerfile`; binds `0.0.0.0:$PORT`. Set all TRD env vars; `FRONTEND_URL` must match the Vercel origin for CORS + cookies.
- **Vercel** builds `frontend/`; set `NEXT_PUBLIC_BACKEND_URL` to the Render URL.
- **Keep-alive:** `.github/workflows/keep-alive.yml` pings `/health` every 10 minutes to reduce Render free-tier cold starts before demos.

## Contributing

1. Branch from `development` using persistent themed branches (`feat/<area>`, `chore/<task>`).
2. One squash PR per small feature into `development`; phase milestones merge `development` → `main` with `--no-ff`.
3. Run `./build.ps1` before opening a PR.
4. Plain commit subjects only — no `Co-authored-by` trailers. Run `./setup-githooks.ps1` once per clone to enable the commit-msg hook.

## License

Academic project — see course submission requirements.
