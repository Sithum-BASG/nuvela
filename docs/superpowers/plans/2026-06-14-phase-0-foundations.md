# Phase 0 — Foundations, Repo, Tokens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clean, themed, runnable skeleton for both deployables — git repo + GitHub remote, NestJS backend, Next.js frontend wired to the Design Brief tokens (light + dark), `.env.example`, and a building backend Dockerfile.

**Architecture:** Two independent apps under the existing repo root (`D:\Projects\Nuvela` *is* `nuvela/` — do **not** create a nested `nuvela/` folder). No monorepo tooling; each app has its own `package.json`. Tokens are wired before any screen so styling is token-only from the first component.

**Tech Stack:** Git + GitHub (`gh`); NestJS CLI; `create-next-app` + `shadcn`; Tailwind; Sora/Roboto via `next/font/google`. Windows + PowerShell.

**Read first:** [02_TRD §Frontend/Backend/Env](../../02_Technical_Requirements_Document.md), [04_UI_UX_Design_Brief.md §Color/Typography/Component/Spacing](../../04_UI_UX_Design_Brief.md), [06_Implementation_Plan §Phase 0](../../06_Implementation_Plan.md). Honor [CLAUDE.md](../../../CLAUDE.md) scope-discipline rules.

**Done-gate (verify all before Phase 1):** `npm run start:dev` (backend) and `npm run dev` (frontend) both run; the frontend renders a shadcn `Button` in **both light and dark** using the token system (no hard-coded hex); the repo tree matches the spec; `.env.example` lists every TRD variable; the backend Dockerfile builds; `./build.ps1` is green.

---

## Task 0.1 — Repo init, structure, GitHub remote

**Branch:** `chore/repo-init`
**Files:**
- Create: `frontend/.gitkeep`, `backend/.gitkeep`, `README.md`, `.gitignore`, `CURRENT_STEP.md`
- (repo root already contains `docs/`, `CLAUDE.md`, `AGENTS.md`, `build.ps1`, `.cursor/`)

- [ ] **Step 1: Initialize git and the working branch**

Run:
```powershell
git init -b main
git add -A
git commit -m "chore: seed planning docs, CLAUDE.md, agent pointers, build script"
git checkout -b chore/repo-init
```
Expected: `main` created with the existing docs/config committed; now on `chore/repo-init`.

- [ ] **Step 2: Add `.gitignore`**

Create `.gitignore`:
```gitignore
# deps
node_modules/
# builds
dist/
.next/
out/
# env / secrets
.env
.env.*
!.env.example
# misc
*.log
.DS_Store
coverage/
```

- [ ] **Step 3: Add placeholder app folders and README skeleton**

Create `frontend/.gitkeep` and `backend/.gitkeep` (empty files). Create `README.md`:
```markdown
# Nuvela

A calm, multi-tenant, role-based Kanban task-management workspace.

- **Frontend:** Next.js (TypeScript) — `frontend/` → Vercel
- **Backend:** NestJS (TypeScript) — `backend/` → Render
- **Data:** PostgreSQL + Storage on Supabase · Email via Resend

See [`docs/`](docs/) for the locked planning suite and [`CLAUDE.md`](CLAUDE.md) for agent guidance.
Setup instructions, stack details, and the Swagger link land in Phase 11.
```

- [ ] **Step 4: Seed `CURRENT_STEP.md`**

Create `CURRENT_STEP.md`:
```markdown
# Current Step

**Where we are:** Phase 0 (Foundations). Just completed: repo init + structure (Task 0.1).

**Next sub-step:** Task 0.2 — Backend init (`chore/backend-init`).
- Goal: scaffold NestJS in `backend/` with the exact TRD dependency set and the MVC module skeleton.
- Read first: [docs/06_Implementation_Plan.md §0.2](docs/06_Implementation_Plan.md), [docs/02_Technical_Requirements_Document.md §Backend](docs/02_Technical_Requirements_Document.md).
- Plan: [docs/superpowers/plans/2026-06-14-phase-0-foundations.md](docs/superpowers/plans/2026-06-14-phase-0-foundations.md) Task 0.2.

**Constraints in play:** no new deps beyond the TRD list; MVC/modular structure; TypeScript.

**Done-criteria:** `npm run start:dev` runs; module skeleton matches the spec tree.

**Branch:** `chore/backend-init`
```

- [ ] **Step 5: Create the GitHub repo and push**

Run:
```powershell
gh repo create nuvela --public --source . --remote origin --push
git push -u origin chore/repo-init
```
Expected: repo created; `main` and `chore/repo-init` pushed. (If `gh` is unauthenticated, run `gh auth login` first.)

- [ ] **Step 6: Protect `main` and open the PR**

Run:
```powershell
gh api -X PUT repos/:owner/nuvela/branches/main/protection -f "required_pull_request_reviews[required_approving_review_count]=0" -F "enforce_admins=true" -F "restrictions=null" -F "required_status_checks=null" 2>$null
gh pr create --base main --head chore/repo-init --title "chore: repo init, structure, GitHub remote" --body "Phase 0 / Task 0.1. Git repo, .gitignore, README, app folders, CURRENT_STEP.md, protected main."
```
Expected: branch protection set (best-effort on free tier — if the API call is rejected, note it and continue); PR opened. **Confirm with the user before merging.**

---

## Task 0.2 — Backend init (NestJS, MVC skeleton)

**Branch:** `chore/backend-init`
**Files:**
- Create: `backend/` (NestJS app) and the module skeleton under `backend/src/`

- [ ] **Step 1: Branch from up-to-date main**

Run:
```powershell
git checkout main; git pull
git checkout -b chore/backend-init
```

- [ ] **Step 2: Scaffold NestJS into `backend/`**

Run (the `.gitkeep` may need removing first if the CLI refuses a non-empty dir):
```powershell
Remove-Item backend/.gitkeep -ErrorAction SilentlyContinue
npx @nestjs/cli@latest new backend --package-manager npm --skip-git
```
Expected: NestJS app scaffolded in `backend/` with `src/main.ts`, `src/app.module.ts`, npm deps installed.

- [ ] **Step 3: Install the exact TRD backend dependency set**

Run:
```powershell
cd backend
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/throttler @nestjs/swagger @nestjs/websockets @nestjs/platform-socket.io socket.io class-validator class-transformer bcrypt prisma @prisma/client cookie-parser
npm install -D @types/passport-jwt @types/bcrypt @types/cookie-parser
cd ..
```
Expected: installs succeed. **Do not add packages beyond this set** (TRD constraint) — if something later seems missing, STOP and ask.

- [ ] **Step 4: Create the MVC/modular folder skeleton**

Create these directories under `backend/src/` (empty `.gitkeep` in each for now; modules are filled in later phases):
```
prisma/  common/  auth/  users/  organizations/  projects/  tasks/
columns/  labels/  comments/  attachments/  activity/  notifications/
search/  mail/
```
Run:
```powershell
cd backend/src
'prisma','common','auth','users','organizations','projects','tasks','columns','labels','comments','attachments','activity','notifications','search','mail' | ForEach-Object { New-Item -ItemType Directory -Force $_ | Out-Null; New-Item -ItemType File -Force "$_/.gitkeep" | Out-Null }
cd ../..
```

- [ ] **Step 5: Add a `typecheck` script**

Modify `backend/package.json` scripts — add:
```json
"typecheck": "tsc --noEmit"
```
(NestJS already provides `build`, `lint`, `start:dev`, `test`.)

- [ ] **Step 6: Verify the backend runs**

Run:
```powershell
cd backend; npm run start:dev
```
Expected: `Nest application successfully started` and a listening message. Stop with Ctrl+C. Then:
```powershell
npm run typecheck; npm run build; cd ..
```
Expected: both exit 0.

- [ ] **Step 7: Commit, update CURRENT_STEP, push, PR**

Update `CURRENT_STEP.md` to point at Task 0.3 (`chore/frontend-init`). Then:
```powershell
git add -A
git commit -m "chore(backend): scaffold NestJS with TRD deps and MVC module skeleton"
git push -u origin chore/backend-init
gh pr create --base main --head chore/backend-init --title "chore(backend): NestJS scaffold + MVC skeleton" --body "Phase 0 / Task 0.2."
```
Expected: PR opened. Confirm before merging.

---

## Task 0.3 — Frontend init (Next.js + shadcn)

**Branch:** `chore/frontend-init`
**Files:**
- Create: `frontend/` (Next.js app) + folder skeleton under `frontend/src/`

- [ ] **Step 1: Branch**

```powershell
git checkout main; git pull
git checkout -b chore/frontend-init
Remove-Item frontend/.gitkeep -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Scaffold Next.js into `frontend/`**

Run:
```powershell
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```
Expected: Next.js App Router app in `frontend/` with Tailwind and `src/`. (It detects the existing git repo and won't re-init.)

- [ ] **Step 3: Initialize shadcn/ui and add the base components**

Run:
```powershell
cd frontend
npx shadcn@latest init -d
npx shadcn@latest add button input dialog dropdown-menu table tabs badge avatar skeleton sonner card select checkbox
cd ..
```
Expected: `src/components/ui/*` populated; `globals.css` gains shadcn CSS variables (these get replaced with Nuvela tokens in Task 0.4).

- [ ] **Step 4: Install the exact TRD frontend dependency set**

Run:
```powershell
cd frontend
npm install @tanstack/react-query zod react-hook-form @hookform/resolvers @dnd-kit/core @dnd-kit/sortable lucide-react socket.io-client date-fns
cd ..
```
Expected: installs succeed. **No packages beyond this set + shadcn's own** (TRD). Note: **do not add `next-themes`** — the theme provider is hand-rolled in Task 0.4 to stay within the approved list.

- [ ] **Step 5: Create the app folder skeleton**

Create under `frontend/src/` (keep `app/` from the scaffold):
```
components/   lib/   hooks/   providers/   types/
```
Run:
```powershell
cd frontend/src
'components','lib','hooks','providers','types' | ForEach-Object { New-Item -ItemType Directory -Force $_ | Out-Null; New-Item -ItemType File -Force "$_/.gitkeep" | Out-Null }
cd ../..
```

- [ ] **Step 6: Add a `typecheck` script**

Modify `frontend/package.json` scripts — add:
```json
"typecheck": "tsc --noEmit"
```
(`create-next-app` already provides `dev`, `build`, `lint`.)

- [ ] **Step 7: Verify the frontend runs and builds**

```powershell
cd frontend; npm run dev
```
Expected: dev server on http://localhost:3000 renders the default page. Ctrl+C, then:
```powershell
npm run typecheck; npm run build; cd ..
```
Expected: both exit 0.

- [ ] **Step 8: Commit, update CURRENT_STEP, push, PR**

Point `CURRENT_STEP.md` at Task 0.4 (`feat/design-tokens`). Then:
```powershell
git add -A
git commit -m "chore(frontend): scaffold Next.js + shadcn with TRD deps and folder skeleton"
git push -u origin chore/frontend-init
gh pr create --base main --head chore/frontend-init --title "chore(frontend): Next.js + shadcn scaffold" --body "Phase 0 / Task 0.3."
```

---

## Task 0.4 — Design tokens + fonts + theme provider (light & dark)

**Branch:** `feat/design-tokens`
**Files:**
- Modify: `frontend/src/app/globals.css` (Nuvela token variables, `:root` + `.dark`)
- Modify: `frontend/src/app/layout.tsx` (fonts + ThemeProvider)
- Create: `frontend/src/providers/theme-provider.tsx`
- Create: `frontend/src/components/theme-toggle.tsx`
- Modify: `frontend/src/app/page.tsx` (token-styled Button + toggle to prove both modes)

> Token values are the Design Brief's exact hexes — do **not** hard-code these anywhere except this token layer; components consume the CSS variables only.
>
> **Figma is authoritative for token values.** The hexes below are the Design Brief values; before finalizing, pull the actual Figma variables and reconcile — especially where the Design Brief is silent (e.g. **dark-mode `accent-tint`**, marked below as a placeholder to replace with the Figma value, not the invented `#2A2752`).

- [ ] **Step 1: Branch, then pull the Figma variables**

```powershell
git checkout main; git pull
git checkout -b feat/design-tokens
```
Then, via the Figma MCP, read the design-system variables and reconcile them against the values in Step 2:
- `get_variable_defs` on the design-system page (`175:2`) to get every color/spacing/radius/typography variable and its light/dark values.
- Use the Figma values verbatim where they differ from the Design Brief; the Design Brief hexes are a fallback only. **If the Figma file URL/key isn't known yet, STOP and ask** before proceeding.

- [ ] **Step 2: Define Nuvela tokens in `globals.css`**

Replace the shadcn-generated `:root`/`.dark` color blocks in `frontend/src/app/globals.css` with the Nuvela semantic tokens (keep shadcn's `@tailwind`/`@theme` plumbing as the version generated it — only swap the color/radius variable *values*):
```css
:root {
  --bg: #F8F9FB;
  --surface: #FFFFFF;
  --border: #E4E6EA;
  --text-primary: #0A1422;
  --text-secondary: #5F5E5A;
  --text-muted: #8C8B85;

  --accent-tint: #EDEBFB;
  --accent: #7C74D6;
  --accent-strong: #5A52B5;        /* accent text/links on light */
  --focus-ring: #7C74D6;

  --success: #2F855A;
  --warning: #B7791F;
  --danger:  #C53030;
  --info:    #7C74D6;

  --radius-control: 8px;
  --radius-card: 12px;
  --radius-badge: 6px;
}

.dark {
  --bg: #16181D;
  --surface: #1D2027;
  --border: #2A2D34;
  --text-primary: #EDEDEB;
  --text-secondary: #B4B2A9;
  --text-muted: #888780;

  --accent-tint: <FROM_FIGMA>;     /* Design Brief is silent on dark accent-tint — use the Figma variable */
  --accent: #8B83E0;               /* brightened fill for dark */
  --accent-strong: #A79FEA;        /* accent text/links on dark */
  --focus-ring: #8B83E0;

  --success: #2F855A;
  --warning: #B7791F;
  --danger:  #C53030;
  --info:    #8B83E0;
}
```
Then map these variables to the Tailwind/shadcn theme tokens the generated config uses (e.g. `--background: var(--bg)`, `--card: var(--surface)`, `--primary: var(--accent)`, `--ring: var(--focus-ring)`, `--radius: var(--radius-card)`), so shadcn components pick up Nuvela colors. Match whatever variable names the installed shadcn version generated — read `globals.css` first and align, do not invent names.

- [ ] **Step 3: Load Sora + Roboto via `next/font/google`**

In `frontend/src/app/layout.tsx`:
```tsx
import { Sora, Roboto } from "next/font/google";

const sora = Sora({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-sora" });
const roboto = Roboto({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-roboto" });
```
Add `${sora.variable} ${roboto.variable}` to the `<html>` className, and set the body default font to Roboto / headings to Sora via the Tailwind theme (`--font-sans: var(--font-roboto)`, plus a `font-display` utility bound to `--font-sora`). Do **not** keep the default `next/font` Geist from the scaffold.

- [ ] **Step 4: Hand-rolled ThemeProvider (no new dependency)**

Create `frontend/src/providers/theme-provider.tsx`:
```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = (localStorage.getItem("nuvela-theme") as Theme | null);
    const initial =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("nuvela-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
```
Wrap `{children}` in `layout.tsx` with `<ThemeProvider>`.

- [ ] **Step 5: Theme toggle component**

Create `frontend/src/components/theme-toggle.tsx`:
```tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 6: Prove both modes on the home page**

Replace `frontend/src/app/page.tsx` body with a minimal token-styled proof:
```tsx
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-sora)" }}>
        Nuvela
      </h1>
      <div className="flex items-center gap-3">
        <Button>Primary</Button>
        <Button variant="outline">Secondary</Button>
        <ThemeToggle />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify light AND dark visually**

```powershell
cd frontend; npm run dev
```
Expected: at http://localhost:3000 the Primary button is Soft Indigo (`#7C74D6`) on a near-white canvas; clicking the toggle flips to the dark canvas (`#16181D`) with the brightened accent (`#8B83E0`) and light text — **no hard-coded colors, all via tokens**. Confirm the accent and surfaces match the Design Brief in both modes. Ctrl+C, then:
```powershell
npm run typecheck; npm run build; cd ..
```
Expected: both exit 0.

- [ ] **Step 8: Commit, update CURRENT_STEP, push, PR**

Point `CURRENT_STEP.md` at Task 0.5 (`chore/env-example`). Then:
```powershell
git add -A
git commit -m "feat(frontend): wire Design Brief tokens, Sora/Roboto fonts, light/dark theme provider"
git push -u origin feat/design-tokens
gh pr create --base main --head feat/design-tokens --title "feat: design tokens + theme toggle (light/dark)" --body "Phase 0 / Task 0.4. Token-only styling proven on a shadcn Button in both modes."
```

---

## Task 0.5 — `.env.example`

**Branch:** `chore/env-example`
**Files:** Create `.env.example` (repo root)

- [ ] **Step 1: Branch**

```powershell
git checkout main; git pull
git checkout -b chore/env-example
```

- [ ] **Step 2: Write `.env.example` with every TRD variable**

Create `.env.example`:
```dotenv
# --- Database (Supabase) ---
DATABASE_URL=            # pooled (PgBouncer) connection — runtime queries
DIRECT_URL=              # direct connection — migrations

# --- Auth (JWT) ---
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# --- Supabase Storage ---
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # backend-only; issues signed URLs

# --- Email (Resend) ---
RESEND_API_KEY=

# --- URLs / CORS ---
FRONTEND_URL=            # CORS origin + cookie domain + email links
BACKEND_URL=            # API base for the client + email links

# --- Runtime ---
NODE_ENV=development
```
> The expiry values are example defaults; real secrets are never committed (they live in each platform's env config).

- [ ] **Step 3: Verify completeness against the TRD**

Cross-check every variable in [TRD §Environment Variables](../../02_Technical_Requirements_Document.md) appears here. Expected: all 11 present (`DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FRONTEND_URL`, `BACKEND_URL`, `NODE_ENV`).

- [ ] **Step 4: Commit, update CURRENT_STEP, push, PR**

Point `CURRENT_STEP.md` at Task 0.6 (`chore/backend-dockerfile`). Then:
```powershell
git add -A
git commit -m "chore: add .env.example with all TRD environment variables"
git push -u origin chore/env-example
gh pr create --base main --head chore/env-example --title "chore: .env.example" --body "Phase 0 / Task 0.5."
```

---

## Task 0.6 — Backend Dockerfile

**Branch:** `chore/backend-dockerfile`
**Files:** Create `backend/Dockerfile`, `backend/.dockerignore`

- [ ] **Step 1: Branch**

```powershell
git checkout main; git pull
git checkout -b chore/backend-dockerfile
```

- [ ] **Step 2: Multi-stage Dockerfile**

Create `backend/Dockerfile`:
```dockerfile
# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate || true   # no schema yet in Phase 0; succeeds once Phase 1 lands
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]
```
> `prisma generate` is guarded with `|| true` for Phase 0 (no schema yet); Phase 1 removes the guard. The `EXPOSE`/port must match `main.ts`'s listen port (set it to `process.env.PORT ?? 3001`).

Create `backend/.dockerignore`:
```
node_modules
dist
.env
.env.*
```

- [ ] **Step 3: Verify the image builds**

Run:
```powershell
docker build -t nuvela-backend ./backend
```
Expected: build completes through both stages with no error. (If Docker Desktop isn't running, start it first.)

- [ ] **Step 4: Commit, update CURRENT_STEP, push, PR**

Point `CURRENT_STEP.md` at **Phase 1, Task 1.1** and note Phase 0's done-gate is met. Then:
```powershell
git add -A
git commit -m "chore(backend): multi-stage Dockerfile + .dockerignore"
git push -u origin chore/backend-dockerfile
gh pr create --base main --head chore/backend-dockerfile --title "chore(backend): Dockerfile" --body "Phase 0 / Task 0.6. Closes Phase 0."
```

---

## Phase 0 exit verification (run before declaring done)

- [ ] `./build.ps1` from the repo root is green (backend + frontend lint/typecheck/build).
- [ ] `cd backend; npm run start:dev` starts Nest; `cd frontend; npm run dev` serves the page.
- [ ] The home page Button renders correctly in **light and dark** via the toggle, colors sourced from tokens only.
- [ ] Repo tree matches: `frontend/ backend/ docs/ build.ps1 README.md .gitignore .env.example CLAUDE.md AGENTS.md .cursor/ CURRENT_STEP.md`.
- [ ] `.env.example` has all 11 TRD variables; no real `.env` is tracked (`git status` clean of secrets).
- [ ] `docker build ./backend` succeeds.
- [ ] All six Task PRs merged to `main` (with user confirmation); `CURRENT_STEP.md` now points at Phase 1.

When all are checked, generate `2026-06-14-phase-1-database.md` and proceed.
```
