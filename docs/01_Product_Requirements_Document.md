# Product Requirements Document — Nuvela

**Document 1 of 6 — Planning Suite**
**Project:** INTE 21323 — Task Management System
**Status:** Locked baseline for implementation

---

## App Name

**Nuvela** *(pronounced noo-VEH-lah)*

## Tagline

A calm, focused workspace where teams plan projects, move work across a board, and stay in sync in real time.

## Problem

Teams coordinating multi-step work across several people lose track of who owns what, what stage each piece is in, and what is waiting on whom. Without one shared place, tasks get duplicated, dropped, or silently stall, and managers have no reliable read on progress until something is already late.

The pain is felt most by the person accountable for delivery — a project manager juggling several projects and contributors — and by contributors who need a clear, uncluttered view of what is actually assigned to them. Existing tools either overwhelm small teams with configuration or under-serve them on accountability and real-time visibility.

Nuvela solves this by giving each organization an isolated workspace where project managers own and run their projects on a visual board, contributors act only on what concerns them, and every meaningful change surfaces instantly through real-time notifications — with a deliberate emphasis on signal over noise.

## Target User

The primary user is a **project manager in a small-to-mid-sized team** who owns one or more projects and is accountable for moving work to completion. They need to create projects, break work into tasks, assign and reassign ownership as people come and go, and see at a glance what is in progress, what is waiting for their review, and what is overdue — without configuration overhead.

The secondary user is a **contributor (Collaborator)** who is invited into specific projects and needs an uncluttered, focused view of the tasks assigned to them, the ability to move their work forward, and a simple way to discuss it and flag the manager when their attention is needed.

The buyer/administrator persona is an **organization Owner** who self-registers, creates the workspace, manages who has access, and — in smaller organizations — often also acts as a project manager themselves.

## Core Value Proposition

What makes Nuvela different from generic task trackers:

It is **multi-tenant and self-serve from day one** — anyone can sign up, create an isolated organization, and invite their team, rather than being an internal single-company tool.

It enforces a **clear, role-based ownership model** rather than a flat "everyone can edit everything" board: project managers own projects, contributors act only on their assigned work, and a manager-gated review stage makes quality control a visible, enforced step rather than an honor system.

It treats **real-time updates as reliable, not best-effort** — every notification is persisted before it is pushed, so offline users never miss what happened while they were away.

It is deliberately **calm**: notifications fire only for things that genuinely need a person's attention (assignments, status changes, @mentions, deadlines), so the workspace never trains users to ignore it.

## Core Features (Must Have)

These constitute the v1 build and map directly to the SRS requirements plus the locked product-grade extensions.

**Identity, organizations, and access**
- Self-serve Owner signup that creates an isolated organization (multi-tenant; every record scoped to one organization).
- Email verification on signup before an account becomes active.
- Four-role model — Owner, Admin, Project Manager, Collaborator — with the Owner as a superset able to also act as a project manager.
- Admin-driven user onboarding: Admin creates Project Managers and Collaborators; the system emails a temporary password (72-hour expiry, with a resend action); forced password reset and complexity enforcement on first login.
- Role hierarchy enforcement: only the Owner creates Admins; Admins create only Project Managers and Collaborators.

**Projects**
- Project Managers create and solely own their projects; each project has exactly one owner.
- Project entity: name, description, owner, color, timestamps.
- Project membership by invitation (from the pool of existing organization users) gates access; a Collaborator may be a member of multiple managers' projects.
- A filtered view so each manager sees only their own projects and each Collaborator sees only invited projects.
- Project archiving (Active/Archived), reversible, preserving all data; archived projects are read-only and fire no notifications.
- Project ownership transfer — both mandatory (on manager deactivation, reassigned per-project to other managers) and voluntary (a manager hands a project to another manager by choice).

**Tasks and the board**
- A four-column Kanban board: To Do → In Progress → Review → Completed.
- A manager-gated transition: only the Project Manager (or Owner) may move a task into Completed or out of it; Collaborators move their assigned tasks freely among the first three columns.
- Task attributes: title (required), description, optional single or multiple assignees, due date, priority (Low/Medium/High), status.
- Optional assignment — "unassigned" is a valid first-class state; assignment is the manager's discretion.
- Card display: stacked assignee avatars with initials-on-color fallback, names on hover, and "+N" overflow; a muted placeholder for unassigned tasks.
- Task detail screen: general info, a checkable text checklist with a progress indicator, file attachments, an append-only activity log, and a comment thread.
- Per-project labels, created and managed by the manager and applied by assignees or the manager.
- Defined restricted fields: Collaborators edit progress (status within allowed columns, checklist, comments, attachments) but not identity fields (title, description, due date, priority, assignees, labels).
- A reassignment dialog when a Collaborator is removed from a project, allowing each of their tasks to be reassigned or deliberately left unassigned.

**Collaboration and real-time**
- Comments on tasks, displayed as a chat-style thread, with @mentions of project members.
- File attachments on tasks, with type/size validation and access scoped to project membership.
- Append-only activity log capturing status changes, assignments, field changes, checklist checks/unchecks, and attachment events.
- Real-time notifications over WebSockets using a persist-then-push model (written to the database first, pushed to online users, replayed to offline users on reconnect).
- Notification surfaces: a bell with an unread badge and dropdown, live toasts for online events, and a full notifications history page with read/unread handling.
- Notification triggers: task assignment, status change, @mention, approaching deadline (24 hours before and again when overdue), and inherited/transferred projects. Plain comments and checklist changes do not notify.

**Dashboards, search, and supporting surfaces**
- A role-aware dashboard: task-focused for Project Managers and Collaborators (my tasks, due-soon, project progress), an organization overview for Admins.
- Simple task search by title and description, strictly scoped to the user's access rights.
- A static Plans page presenting Free and Pro tiers, with Pro features marked "coming soon" (no payment integration in v1).

**Quality, security, and delivery (per SRS)**
- JWT-based authentication stored in HTTP-only cookies, with expiry and refresh handling.
- Authorization enforced server-side on every protected route (401 unauthorized, 403 forbidden).
- Security hardening: parameterized queries/ORM, bcrypt password hashing, input validation and sanitization (XSS/SQLi), HTTPS/TLS, OWASP Top 10 awareness.
- Frontend and backend validation with structured error responses (code, message, description).
- MVC architecture, Docker containerization, CI/CD, cloud deployment with live demo URLs, Swagger/OpenAPI documentation, and a clean modular repository.

## Nice to Have (v2)

Deferred deliberately to keep v1 focused and fully polished. Several of these are surfaced in the product as Pro "coming soon" items, which doubles as the monetization narrative.

- Customizable Kanban columns per project (the data model is already built to allow this without a rewrite).
- Data export (CSV/JSON) — listed as a Pro feature.
- Real payment and subscription billing behind the Plans page.
- Notification preferences (mute a project, per-type toggles).
- Email notifications beyond onboarding (e.g. deadline reminders by email).
- Temp-password/invite-link refinements and richer audit views.
- A read-only Viewer project role.
- Project keys and per-project task numbering (e.g. NUV-1, NUV-2).
- Recursive subtasks with their own assignees and dates (v1 uses lightweight checklists instead).
- An embedded LLM assistant in the task comment thread (the comment model is designed to allow an AI participant later).

## Out of Scope

This version explicitly does **not**:

- Process real payments or enforce any paid-tier feature gating — the Plans page is descriptive only, and the Free tier has no restrictions.
- Permanently delete projects or tasks — the lifecycle is archive-only, with no hard delete and no cascade deletion.
- Provide customizable workflow columns — the four columns are fixed in v1 (though the schema permits future customization).
- Offer offline editing or a native mobile app — it is a responsive web application.
- Include analytics dashboards beyond the personal/role-aware dashboard, time tracking, billing of clients, or Gantt/timeline views.
- Support cross-organization sharing — organizations are fully isolated by design.

## User Stories

**Owner / organization setup**
- As a prospective customer, I want to sign up and create my own organization so that my team has an isolated workspace.
- As an Owner, I want to verify my email before my account activates so that the workspace is tied to a real address.
- As an Owner, I want to add Admins so that I can delegate user management.
- As an Owner of a small team, I want to also create and run projects myself so that I don't need a separate manager account.

**Admin / user management**
- As an Admin, I want to create Project Manager and Collaborator accounts so that my colleagues can access the workspace.
- As an Admin, I want the system to email new users a temporary password and force a reset on first login so that onboarding is secure.
- As an Admin, I want to resend an invite if a temporary password expires so that a delayed user isn't permanently locked out.
- As an Admin, I want to deactivate a Project Manager and reassign each of their projects to other managers so that no project is left without an owner.

**Project Manager**
- As a Project Manager, I want to create a project and see only my own projects so that my workspace stays focused.
- As a Project Manager, I want to invite existing users to my project so that they can access its tasks.
- As a Project Manager, I want to create tasks and optionally assign them so that work is tracked even before an owner is decided.
- As a Project Manager, I want to be the only one who can move a task into Completed so that I can gate quality through a review step.
- As a Project Manager, I want a reassignment dialog when I remove a Collaborator so that their tasks are handled deliberately rather than silently orphaned.
- As a Project Manager, I want to transfer a project to another manager so that ownership can change cleanly when responsibilities shift.
- As a Project Manager, I want to archive a finished project so that it leaves my active view without losing its history.

**Collaborator**
- As a Collaborator, I want to see only the projects I'm invited to so that my view isn't cluttered with unrelated work.
- As a Collaborator, I want to move my assigned tasks across To Do, In Progress, and Review so that I can show progress.
- As a Collaborator, I want to comment and @mention the manager so that I can flag when their attention is needed.
- As a Collaborator, I want to attach files and check off checklist items so that my work is documented.

**All users / real-time**
- As any user, I want to receive a real-time notification when I'm assigned a task or @mentioned so that I can respond promptly.
- As any user, I want notifications I missed while offline to appear when I return so that nothing is lost.
- As any user, I want a dashboard showing what's on my plate so that I know where to start.
- As any user, I want to search for a task by name within what I can access so that I can find things quickly.

## Success Metrics

Because this is an academic deliverable framed as a monetization-ready product, success is measured on two honest layers.

**Project / evaluation success (the real bar for this version)**
- Every SRS-required module is implemented and demonstrable live: auth/RBAC, user management, task management, real-time notifications, security, and deployment.
- All four roles function with correct, server-enforced permission boundaries (verifiable by attempting forbidden actions and receiving 401/403).
- The real-time path is demonstrable in two side-by-side sessions, including offline replay on reconnect.
- Both frontend and backend are deployed at working public URLs with Swagger documentation reachable.
- The repository is clean, modular, and consistent (no mixed conventions or dead code), reflecting deliberate human judgment over raw generation.

**Product-hypothetical success (what would be tracked if Nuvela were live)**
- Activation: a new Owner creates an organization and at least one project with one task within the first session.
- Engagement: a meaningful share of created tasks reach the Completed column (a healthy completion rate rather than tasks stalling).
- Real-time value: notifications are opened/acted on rather than ignored, indicating the "signal over noise" design is working.
- Retention proxy: organizations return across multiple sessions and add additional members beyond the Owner.

---

*This PRD is the locked baseline. The remaining five documents — Technical Requirements, App Flow, UI/UX Design Brief, Backend Schema, and Implementation Plan — build on the scope defined here.*
