# Technical Requirements Document — Nuvela

**Document 2 of 6 — Planning Suite**
**Project:** INTE 21323 — Task Management System
**Status:** Locked baseline for implementation

---

## Overview

This document locks the technical stack and hard constraints for Nuvela so that implementation stays coherent across every file. All choices are made against two fixed inputs: the SRS requirements (MVC, JWT in HTTP-only cookies, WebSockets, Swagger, ORM with parameterized queries, Docker/CI-CD/cloud deployment) and the practical constraints of a solo developer building on free-tier infrastructure.

The guiding principle is **one language across the whole stack** — TypeScript on both frontend and backend — so types, tooling, and mental model are shared.

## Stack Summary

| Layer | Choice |
|---|---|
| Frontend | Next.js (TypeScript), used as the React client / UI layer |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | NestJS (TypeScript) — MVC architecture |
| ORM | Prisma |
| Database | PostgreSQL on Supabase |
| File storage | Supabase Storage (private buckets, signed URLs) |
| Auth | Self-rolled JWT (Passport) + bcrypt, HTTP-only cookies |
| Real-time | Socket.IO via NestJS WebSocket gateway |
| Email | Resend |
| Frontend hosting | Vercel (free tier) |
| Backend hosting | Render (free tier) |
| Database + storage hosting | Supabase (free tier) |

## Frontend

**Framework:** Next.js with TypeScript, used as a decoupled React client. The application is entirely behind authentication (a dashboard), so Next.js is used for its modern React tooling and developer experience rather than for SSR/SEO; all data and real-time traffic go to the separate NestJS backend over HTTPS/WSS. This keeps the SRS's Frontend and Backend graded categories cleanly separated.

**Styling and components:** Tailwind CSS as the utility layer, with shadcn/ui as the component foundation (accessible components built on Radix primitives, copied into the repo and fully owned). This gives a single consistent design system across every dialog, dropdown, toast, tab, and form — which both earns the Frontend polish marks and guards against the inconsistency that strict, AI-aware grading looks for.

**Specialist frontend libraries:**
- **dnd-kit** — drag-and-drop for the Kanban board (a hero feature; accessible and well-maintained).
- **Lucide** — icon set (shadcn's native default).
- **TanStack Query (React Query)** — server state and caching; its loading states also gracefully cover backend cold-starts.
- **Zod + React Hook Form** (+ `@hookform/resolvers`) — form state and immediate, field-level validation; native to shadcn's form primitives.
- **socket.io-client** — real-time client.
- **date-fns** — due-date handling and deadline logic.

## Backend

**Framework:** NestJS (TypeScript). Chosen specifically because it satisfies the SRS technical requirements natively rather than by hand-assembly:
- **MVC / modular structure** — controllers, services, and modules map directly onto the SRS's required `/controllers`, `/services` structure and the "Uses MVC pattern" requirement.
- **Swagger/OpenAPI** — `@nestjs/swagger` generates API docs from decorators (SRS documentation requirement, largely automatic).
- **WebSockets** — built-in gateway support with a Socket.IO adapter (SRS real-time requirement).
- **Validation** — `ValidationPipe` with class-validator rejects bad input before controller logic runs (SRS backend validation requirement).
- **Guards** — declarative auth and role guards map onto the SRS's 401/403 requirements.

**Architecture:** decoupled from the frontend — the backend is an independent deployable exposing a REST API plus a WebSocket gateway. CORS is configured to allow the Vercel frontend origin with credentials (required for the HTTP-only auth cookies).

**Key backend libraries:**
- `@nestjs/swagger` — OpenAPI documentation.
- `@nestjs/passport` + `passport-jwt` — JWT authentication strategy.
- `@nestjs/websockets` + Socket.IO adapter — real-time gateway.
- `@prisma/client` — database access.
- `bcrypt` — password hashing.
- `class-validator` + `class-transformer` — DTO validation.
- `@nestjs/throttler` — rate limiting on authentication endpoints (OWASP-aligned, a deliberate security hardening beyond the SRS minimum).
- `@nestjs/config` — environment variable management.

## Database and ORM

**Database:** PostgreSQL on Supabase. The data model is deeply relational (organizations own users, projects belong to managers, with many-to-many project memberships and labels), so a relational database with real foreign keys and integrity constraints is the correct fit.

**ORM:** Prisma. The schema is defined once in a single Prisma schema file (which becomes the basis for the Backend Schema document), generating a fully type-safe client. Prisma parameterizes all queries and never concatenates SQL, which structurally satisfies the SRS's SQL-injection-prevention requirement.

**Connection handling:** Supabase provides a pooled connection string (PgBouncer) for application queries and a direct connection for migrations. Prisma is configured with `DATABASE_URL` (pooled) for runtime and `DIRECT_URL` (direct) for migrations.

**File storage:** Supabase Storage, using the same provider as the database for a consolidated infrastructure footprint. Buckets are kept **private**; the NestJS backend checks the requesting user's project membership and issues short-lived **signed URLs**, so all file access flows through backend authorization rather than public bucket URLs. This satisfies both the SRS attachment requirement and its access-control/security requirements.

## Authentication and Authorization

Authentication is **self-rolled** in NestJS rather than delegated to a managed service, because the SRS makes the auth mechanics explicit graded requirements (15% Security) and the custom Admin-provisioned onboarding flow needs full control.

**Mechanics:**
- **Passport JWT strategy** with NestJS guards.
- **bcrypt** for password hashing — applied to both the system-generated temporary password and the user-chosen password after forced reset. Plaintext is never stored.
- **Access + refresh token pair** — a short-lived access token and a longer-lived refresh token, both delivered as **HTTP-only cookies** (per the SRS; immune to XSS token theft). A refresh endpoint issues new access tokens on expiry.
- **JWT payload** — user ID, role, organization ID, and expiry. Organization ID is included so multi-tenant authorization checks avoid a database lookup on every request.
- **Cross-origin cookies** — because frontend (Vercel) and backend (Render) are on different domains, cookies are configured `Secure` + `SameSite=None`, and CORS allows credentials from the frontend origin.

**Authorization (RBAC):**
- A JWT auth guard returns **401** on missing/invalid/expired tokens.
- A roles guard returns **403** on insufficient permissions.
- Every protected route and every WebSocket connection is guarded; multi-tenant queries are always scoped by the organization ID from the token.

## Real-Time

**Transport:** Socket.IO via the NestJS WebSocket gateway. Socket.IO is chosen over raw WebSockets because it provides, out of the box, the reliability features the SRS explicitly requires — automatic reconnection with backoff — plus "rooms" for targeted delivery that map perfectly onto per-user, role-based notifications.

**Authentication:** the socket connection is authenticated with the same JWT on connect; a gateway guard validates it before the socket joins the user's private room. This satisfies the SRS's "prevent unauthorized subscription to events."

**Delivery model — persist-then-push:** every notification is written to the database first, then pushed over Socket.IO to online users. Offline users fetch unread notifications on reconnect. This satisfies the SRS offline-storage-and-replay requirement and makes the full notifications history page possible.

**Security:** WSS (encrypted WebSocket) in production, consistent with the HTTPS-only requirement.

## Validation (Two Layers)

Per the SRS, validation runs at both layers, serving different purposes:
- **Frontend (immediate feedback):** Zod schemas with React Hook Form provide instant, field-level validation as the user types. Native to shadcn's form components.
- **Backend (authoritative gate):** class-validator decorators on NestJS DTOs, enforced by `ValidationPipe`, reject invalid input before it reaches controller logic and produce the SRS's structured error responses (error code, message, description). The client is never trusted; the backend is the real integrity gate.

## Email

**Service:** Resend (free tier), wrapped in a single NestJS email module that handles all transactional mail through one place: Owner email verification, Admin onboarding temporary-password emails, and any future notification emails. Email verification is always enforced; for demos, a single live signup demonstrates it while pre-provisioned verified accounts cover the rest of the walkthrough.

## Hosting and Deployment

| Component | Platform | Notes |
|---|---|---|
| Frontend | Vercel (free) | Native Next.js host; auto-deploy on push; HTTPS URL. |
| Backend | Render (free) | Node/Docker; supports WebSockets; HTTPS URL. Cold-starts after idle are mitigated with loading states, pre-demo warm-up, and an optional keep-alive ping. |
| Database + Storage | Supabase (free) | Postgres + private storage buckets. |

**Containerization and CI/CD (SRS DevOps, 20%):** the backend builds from a **Dockerfile** (satisfies containerization); both Vercel and Render auto-deploy on git push, and GitHub Actions provides the CI pipeline (lint/test/build) — detailed in the Implementation Plan. All deployed services are served over HTTPS, and CORS plus environment configuration are set for production.

## Third-Party Services

| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database + file storage |
| Resend | Transactional email (verification, onboarding) |
| Vercel | Frontend hosting |
| Render | Backend hosting |
| GitHub Actions | CI/CD |

No Stripe (the Plans page is static/coming-soon, no payment integration). No third-party auth service (auth is self-rolled). No LLM/OpenAI in v1 (the AI assistant is a parked v2 item).

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooled connection (runtime queries) |
| `DIRECT_URL` | Supabase direct connection (migrations) |
| `JWT_ACCESS_SECRET` | Signing secret for access tokens |
| `JWT_REFRESH_SECRET` | Signing secret for refresh tokens |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | Token lifetimes |
| `SUPABASE_URL` | Supabase project URL (Storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend key for issuing signed storage URLs |
| `RESEND_API_KEY` | Email sending |
| `FRONTEND_URL` | CORS origin, cookie domain, email links |
| `BACKEND_URL` | Base URL for API/email links |
| `NODE_ENV` | Environment mode |

Secrets are never committed; each platform's environment configuration holds production values.

## Hard Constraints

These keep implementation (including AI-assisted implementation) within bounds:

- **Free tier only** across all platforms (Vercel, Render, Supabase, Resend).
- **TypeScript everywhere** — one language across the stack.
- **Backend follows MVC / modular structure** (controllers, services, modules) per the SRS.
- **JWT in HTTP-only cookies** — never localStorage or other client-readable storage.
- **All database access through Prisma** — no raw SQL string concatenation.
- **HTTPS/WSS only** in production.
- **Decoupled architecture** — frontend and backend are separate deployables; the frontend never holds business logic that belongs on the server.
- **Multi-tenant isolation** — every query is scoped by organization ID; no cross-organization data access.
- **File access via backend-issued signed URLs** — never public storage buckets.
- **Responsive** — the UI must work on mobile as well as desktop.
- **Consistent design system** — all UI built from the shadcn/ui component set to maintain visual coherence.

---

*This TRD is the locked technical baseline. The App Flow, UI/UX Design Brief, Backend Schema, and Implementation Plan all build on these choices.*
