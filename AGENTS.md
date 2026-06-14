# AGENTS.md

**[CLAUDE.md](CLAUDE.md) is the canonical agent guide for this repository** — the single source of truth for any AI agent (Codex, Cursor, Claude Code, or otherwise). **Read it in full before doing anything.**

This file exists only so tools that look for `AGENTS.md` are pointed at it. Do **not** duplicate guidance here — update `CLAUDE.md` instead and keep this a pointer.

## The few rules you must not miss (full detail in CLAUDE.md)

- **The planning docs in `docs/` are binding.** Never invent stack, fields, routes, screens, or defaults. If something is genuinely unspecified, **STOP and ask**.
- **The repo is pre-code.** Verify a file/command/folder exists before assuming it (read/grep/run first) — don't claim things exist or fabricate output. `CURRENT_STEP.md` holds the live "do this next" step.
- **Don't over-engineer.** Build only what the current sub-step needs — no new dependencies beyond the TRD list, no speculative abstraction, no features/fields/endpoints beyond the docs.
- **Cross-cutting invariants are non-negotiable:** org-scoped multi-tenancy, JWT in HTTP-only cookies, 401/403/404 RBAC, PM-gated Completed column, signed-URL file access, persist-then-push notifications, no hard deletes, two-layer validation.
- **Ship every sub-step to GitHub** on a `feat/…`-style branch → PR (never commit to `main`), and update `CURRENT_STEP.md` as the last action.
- **Full build/test:** `./build.ps1`.
