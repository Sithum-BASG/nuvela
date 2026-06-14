# Backend Schema — Nuvela

**Document 5 of 6 — Planning Suite**
**Project:** INTE 21323 — Task Management System
**Status:** Locked baseline for implementation

---

## Purpose

This document defines Nuvela's data model precisely: every table, column, type, key, and relationship, plus the authorization rules that govern who can access what. It is the source of truth from which the Prisma schema, database migrations, API routes, and auth guards are generated. Because schema changes are painful once real data exists, every entity and constraint we locked across planning is captured here explicitly.

**Two foundational rules that pervade the whole schema:**

1. **Multi-tenant isolation.** Every domain table carries an `organizationId`, and every query is scoped by it. No row is ever readable across organizations. This is the single most important invariant in the system.
2. **Application-layer authorization (not RLS).** Access control is enforced in the NestJS application layer via JWT auth guards and role/ownership checks — *not* Postgres Row-Level Security. This is deliberate: we use Supabase purely as managed Postgres (not its Auth/RLS stack), and the role logic (Owner ⊇ Admin, single-PM-per-project, membership-gates-access) lives in code where it's testable and where the SRS-graded JWT/RBAC mechanics are demonstrated. The authorization rules each table requires are documented per-entity below.

---

## Entity Overview

| Entity | Purpose |
|---|---|
| `Organization` | The multi-tenant root; one per Owner signup. |
| `User` | A person in an organization (Owner / Admin / PM / Collaborator). |
| `Project` | Owned by exactly one PM; the container for tasks. |
| `ProjectMember` | Join table: which users are invited to which projects (gates access). |
| `Column` | A board column per project (To Do / In Progress / Review / Completed), extensible. |
| `Task` | A unit of work belonging to a project and a column. |
| `TaskAssignee` | Join table: which users are assigned to a task (optional, multiple). |
| `Label` | A per-project label/tag. |
| `TaskLabel` | Join table: labels applied to tasks. |
| `ChecklistItem` | A checkable text item on a task. |
| `Comment` | A comment on a task (supports @mentions). |
| `Attachment` | A file attached to a task (stored in Supabase Storage; DB holds metadata). |
| `ActivityLog` | Append-only record of task events (status, assignment, checklist, fields). |
| `Notification` | A persisted notification (persist-then-push model). |
| `RefreshToken` | Server-side record for JWT refresh / session invalidation. |

---

## Enumerations

```
Role            = OWNER | ADMIN | PROJECT_MANAGER | COLLABORATOR
UserStatus      = PENDING | ACTIVE | DEACTIVATED
Priority        = LOW | MEDIUM | HIGH
ProjectStatus   = ACTIVE | ARCHIVED
NotificationType= TASK_ASSIGNED | STATUS_CHANGED | MENTION | DEADLINE | PROJECT_TRANSFERRED
ActivityType    = STATUS_CHANGED | ASSIGNED | UNASSIGNED | FIELD_CHANGED |
                  CHECKLIST_CHECKED | CHECKLIST_UNCHECKED | ATTACHMENT_ADDED | COMMENT_ADDED
```

---

## Tables

Notation: `PK` primary key, `FK` foreign key, `UQ` unique, `?` nullable. All `id` fields are `uuid` (default generated). All tables have `createdAt` / `updatedAt` timestamps unless noted.

### Organization
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Editable by Owner |
| `ownerId` | uuid | FK → User.id (the Owner). Set after Owner is created. |
| `createdAt` / `updatedAt` | timestamp | |

### User
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `organizationId` | uuid | FK → Organization.id |
| `email` | text | UQ **within organization** (composite unique with `organizationId`) |
| `name` | text | |
| `passwordHash` | text | bcrypt; never plaintext |
| `role` | Role | OWNER / ADMIN / PROJECT_MANAGER / COLLABORATOR |
| `status` | UserStatus | PENDING (invited, not yet first-logged-in) / ACTIVE / DEACTIVATED |
| `emailVerified` | boolean | Owners verify at signup; default false |
| `mustResetPassword` | boolean | True for Admin-created users until first-login reset |
| `tempPasswordExpiresAt` | timestamp? | 72h expiry for the onboarding temp password |
| `createdAt` / `updatedAt` | timestamp | |

Constraints: email unique *per organization* (the same email could exist in two different orgs, since orgs are isolated tenants).

### Project
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `organizationId` | uuid | FK → Organization.id |
| `name` | text | Required |
| `description` | text? | Optional |
| `color` | text | Hex/token for the project color |
| `status` | ProjectStatus | ACTIVE / ARCHIVED |
| `managerId` | uuid | FK → User.id — the single owning PM (or Owner acting as PM) |
| `createdAt` / `updatedAt` | timestamp | |

Constraint: exactly one `managerId` per project (enforced by the column being non-null and single-valued). On PM deactivation/transfer, `managerId` is reassigned (never null).

### ProjectMember (join: User ↔ Project)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `projectId` | uuid | FK → Project.id |
| `userId` | uuid | FK → User.id |
| `createdAt` | timestamp | (invited-at) |

Constraints: UQ (`projectId`, `userId`) — a user is a member at most once per project. Membership is what **gates access** to a project's tasks. A user can be a member of many projects across different PMs.

### Column (board column)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `projectId` | uuid | FK → Project.id |
| `name` | text | "To Do" / "In Progress" / "Review" / "Completed" |
| `position` | int | Order on the board |
| `isCompletedColumn` | boolean | Marks the "done" column (drives completion logic, PM-gating, deadline-skip) |
| `isPmGated` | boolean | True for the Completed column — only PM may move tasks into it |

Seeded with the four default columns per project at creation. Modeled as a table (not a hard enum) so per-project custom columns are a future addition without a rewrite.

### Task
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `organizationId` | uuid | FK → Organization.id (denormalized for tenant-scoped queries) |
| `projectId` | uuid | FK → Project.id |
| `columnId` | uuid | FK → Column.id (current status) |
| `title` | text | Required (the only mandatory task field) |
| `description` | text? | Optional |
| `priority` | Priority | LOW / MEDIUM / HIGH |
| `dueDate` | timestamp? | Optional |
| `position` | int | Order within its column |
| `createdById` | uuid | FK → User.id |
| `createdAt` / `updatedAt` | timestamp | |

Note: assignees are **not** a column here — they're the `TaskAssignee` join (optional, zero-or-many). "Unassigned" is simply no rows in `TaskAssignee`.

### TaskAssignee (join: User ↔ Task)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `taskId` | uuid | FK → Task.id |
| `userId` | uuid | FK → User.id |

Constraints: UQ (`taskId`, `userId`). Zero rows = unassigned (a valid first-class state). Assignee must be a member of the task's project (enforced in app layer).

### Label
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `projectId` | uuid | FK → Project.id (labels are per-project) |
| `name` | text | |
| `color` | text | Token/hex |

### TaskLabel (join: Label ↔ Task)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `taskId` | uuid | FK → Task.id |
| `labelId` | uuid | FK → Label.id |

Constraint: UQ (`taskId`, `labelId`).

### ChecklistItem
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `taskId` | uuid | FK → Task.id |
| `text` | text | |
| `isChecked` | boolean | |
| `position` | int | |

The *who/when* of checking lives in `ActivityLog`, not here (keeps items lightweight).

### Comment
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `taskId` | uuid | FK → Task.id |
| `authorId` | uuid | FK → User.id |
| `body` | text | |
| `createdAt` | timestamp | |

@mentions are parsed from `body`; each mention generates a `Notification` (plain comments do not notify). A `CommentMention` join (below) records resolved mentions for reliable notification targeting.

### CommentMention (join: Comment ↔ User)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `commentId` | uuid | FK → Comment.id |
| `userId` | uuid | FK → User.id (the mentioned member) |

### Attachment
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `taskId` | uuid | FK → Task.id |
| `uploadedById` | uuid | FK → User.id |
| `fileName` | text | Original name |
| `mimeType` | text | Validated server-side |
| `sizeBytes` | int | Validated against a max |
| `storageKey` | text | Path/key in the Supabase Storage bucket (the file itself is NOT in the DB) |
| `createdAt` | timestamp | |

The binary lives in Supabase Storage (private bucket); the DB stores only metadata + the storage key.

### ActivityLog (append-only)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `taskId` | uuid | FK → Task.id |
| `actorId` | uuid | FK → User.id (who did it) |
| `type` | ActivityType | What happened |
| `metadata` | jsonb? | e.g. {from: "In Progress", to: "Review"} or the checklist item text |
| `createdAt` | timestamp | |

Never updated or deleted — this is the accountability/audit record. Checklist checks log here (no notification).

### Notification (persist-then-push)
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `organizationId` | uuid | FK → Organization.id |
| `recipientId` | uuid | FK → User.id |
| `type` | NotificationType | |
| `payload` | jsonb | Context (taskId, projectId, actorId, etc.) for rendering + deep-linking |
| `isRead` | boolean | Default false; drives the unread badge |
| `createdAt` | timestamp | |

Written to the DB first, then pushed over Socket.IO if the recipient is online; offline recipients fetch unread on reconnect.

### RefreshToken
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `userId` | uuid | FK → User.id |
| `tokenHash` | text | Hashed refresh token (never store the raw token) |
| `expiresAt` | timestamp | |
| `revokedAt` | timestamp? | For logout / session invalidation |
| `createdAt` | timestamp | |

Enables refresh-token rotation and server-side revocation (logout, deactivation).

---

## Relationships Summary

```
Organization 1───* User
Organization 1───* Project
Organization 1───* Task
Organization 1───* Notification

User (manager) 1───* Project          (managerId; one PM per project)
User 1───* ProjectMember *───1 Project   (membership / access gate)
User 1───* TaskAssignee  *───1 Task      (optional, multiple assignees)
User 1───* Comment / Attachment / ActivityLog / Notification / RefreshToken

Project 1───* Column
Project 1───* Task
Project 1───* Label

Task 1───1 Column (current status)
Task 1───* TaskAssignee / TaskLabel / ChecklistItem / Comment / Attachment / ActivityLog

Comment 1───* CommentMention *───1 User
Label 1───* TaskLabel *───1 Task
```

**Cascade / lifecycle behavior:**
- Projects are **never hard-deleted** — only `status = ARCHIVED` (read-only, reversible). No cascade deletion of tasks.
- Deactivating a user sets `status = DEACTIVATED` (soft) rather than deleting the row, preserving authorship/history. PM deactivation reassigns owned projects (mandatory) and auto-unassigns their `TaskAssignee` rows elsewhere (with notifications).
- Removing a `ProjectMember` triggers the reassignment dialog for that user's `TaskAssignee` rows in that project (reassign or leave unassigned).

---

## Authorization Model (application layer)

Enforced in NestJS via a JWT auth guard (401 on invalid/expired token) and role/ownership guards (403 on insufficient permission). The JWT payload carries `userId`, `role`, and `organizationId`.

**Global rule:** every request is scoped to the caller's `organizationId`; cross-tenant access is impossible. A resource in another tenant returns 404 (not 403), so existence isn't revealed.

| Role | Capabilities |
|---|---|
| **Owner** | Superset. All Admin powers + all PM powers (can own/run projects) + org-exclusive (rename org, add/remove Admins, billing). Cannot be deactivated. Appears in PM-pickers as a transfer target. |
| **Admin** | User management only: create PM/Collaborator users, assign roles, deactivate, resend invites. **Cannot** create/see project contents. Cannot create other Admins (Owner-only). |
| **Project Manager** | Create/own projects; full control of *their own* projects' tasks (CRUD, assign, set fields, manage members, labels, archive, transfer). Sees only their own projects. |
| **Collaborator** | On projects they're a member of: view all tasks in the project; on tasks assigned to them, update status (within non-gated columns), check checklist items, comment, attach. Cannot edit restricted fields, delete tasks, or move into Completed. |

**Per-entity access rules (the security-critical part):**

- **Project read:** Owner (any in org), owning PM, or a `ProjectMember`. Others → 404.
- **Project write (settings/archive/transfer/members):** owning PM or Owner only.
- **Task read:** any member of the task's project (membership gates visibility).
- **Task create/delete + restricted fields** (title, description, dueDate, priority, assignees, labels, columnId into a gated column): owning PM / Owner only.
- **Task progress fields** (status within non-gated columns, checklist toggles): assignees of that task, plus the PM/Owner.
- **Move into / out of Completed (gated column):** PM / Owner only (enforced via `Column.isPmGated`).
- **Comment / attachment create:** any project member; **delete own** comment/attachment, or PM/Owner.
- **User management endpoints:** Admin / Owner only; creating Admins → Owner only.
- **Org settings:** Owner only.
- **Notifications:** a user reads/marks only their own (`recipientId == caller`).
- **Assignee constraint:** a user can only be assigned to a task if they're a `ProjectMember` of that task's project (validated server-side).

---

## Sensitive Fields & Storage

- **Passwords:** `passwordHash` only (bcrypt). Plaintext never stored or logged.
- **Refresh tokens:** stored hashed (`tokenHash`); raw token only ever in the HTTP-only cookie.
- **JWT secrets, Supabase keys, Resend key:** environment variables, never in the DB or repo.
- **File binaries:** in Supabase Storage (private bucket), never in the DB. The DB holds `storageKey` + metadata. Downloads go through the backend, which checks project membership and issues a short-lived **signed URL** — buckets are never public.
- **No payment data** stored — the Plans page is static/coming-soon; no card data enters the system.

## File / Media Storage Structure

Supabase Storage, private bucket, keyed by tenant and task to keep isolation clear:

```
attachments/{organizationId}/{projectId}/{taskId}/{attachmentId}-{filename}
```

Access is always mediated by the backend (membership check → signed URL with short TTL). Validation on upload: allowed MIME types and a max `sizeBytes`.

---

## Prisma Schema (centerpiece)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Supabase pooled
  directUrl = env("DIRECT_URL")        // Supabase direct (migrations)
}

enum Role { OWNER ADMIN PROJECT_MANAGER COLLABORATOR }
enum UserStatus { PENDING ACTIVE DEACTIVATED }
enum Priority { LOW MEDIUM HIGH }
enum ProjectStatus { ACTIVE ARCHIVED }
enum NotificationType { TASK_ASSIGNED STATUS_CHANGED MENTION DEADLINE PROJECT_TRANSFERRED }
enum ActivityType {
  STATUS_CHANGED ASSIGNED UNASSIGNED FIELD_CHANGED
  CHECKLIST_CHECKED CHECKLIST_UNCHECKED ATTACHMENT_ADDED COMMENT_ADDED
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  ownerId   String?
  owner     User?    @relation("OrgOwner", fields: [ownerId], references: [id])
  users     User[]   @relation("OrgUsers")
  projects  Project[]
  tasks     Task[]
  notifications Notification[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id                    String   @id @default(uuid())
  organizationId        String
  organization          Organization @relation("OrgUsers", fields: [organizationId], references: [id])
  email                 String
  name                  String
  passwordHash          String
  role                  Role
  status                UserStatus   @default(PENDING)
  emailVerified         Boolean      @default(false)
  mustResetPassword     Boolean      @default(false)
  tempPasswordExpiresAt DateTime?
  ownedOrg              Organization[] @relation("OrgOwner")
  managedProjects       Project[]      @relation("ProjectManager")
  memberships           ProjectMember[]
  assignments           TaskAssignee[]
  comments              Comment[]
  mentions              CommentMention[]
  attachments           Attachment[]
  activities            ActivityLog[]
  notifications         Notification[]
  refreshTokens         RefreshToken[]
  createdTasks          Task[]         @relation("TaskCreator")
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  @@unique([organizationId, email])
}

model Project {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String
  description    String?
  color          String
  status         ProjectStatus @default(ACTIVE)
  managerId      String
  manager        User     @relation("ProjectManager", fields: [managerId], references: [id])
  members        ProjectMember[]
  columns        Column[]
  tasks          Task[]
  labels         Label[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ProjectMember {
  id        String  @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  @@unique([projectId, userId])
}

model Column {
  id                String  @id @default(uuid())
  projectId         String
  project           Project @relation(fields: [projectId], references: [id])
  name              String
  position          Int
  isCompletedColumn Boolean @default(false)
  isPmGated         Boolean @default(false)
  tasks             Task[]
}

model Task {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  projectId      String
  project        Project  @relation(fields: [projectId], references: [id])
  columnId       String
  column         Column   @relation(fields: [columnId], references: [id])
  title          String
  description    String?
  priority       Priority @default(MEDIUM)
  dueDate        DateTime?
  position       Int
  createdById    String
  createdBy      User     @relation("TaskCreator", fields: [createdById], references: [id])
  assignees      TaskAssignee[]
  labels         TaskLabel[]
  checklist      ChecklistItem[]
  comments       Comment[]
  attachments    Attachment[]
  activities     ActivityLog[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model TaskAssignee {
  id     String @id @default(uuid())
  taskId String
  task   Task   @relation(fields: [taskId], references: [id])
  userId String
  user   User   @relation(fields: [userId], references: [id])
  @@unique([taskId, userId])
}

model Label {
  id        String @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  name      String
  color     String
  tasks     TaskLabel[]
}

model TaskLabel {
  id      String @id @default(uuid())
  taskId  String
  task    Task   @relation(fields: [taskId], references: [id])
  labelId String
  label   Label  @relation(fields: [labelId], references: [id])
  @@unique([taskId, labelId])
}

model ChecklistItem {
  id        String  @id @default(uuid())
  taskId    String
  task      Task    @relation(fields: [taskId], references: [id])
  text      String
  isChecked Boolean @default(false)
  position  Int
}

model Comment {
  id        String   @id @default(uuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id])
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  body      String
  mentions  CommentMention[]
  createdAt DateTime @default(now())
}

model CommentMention {
  id        String  @id @default(uuid())
  commentId String
  comment   Comment @relation(fields: [commentId], references: [id])
  userId    String
  user      User    @relation(fields: [userId], references: [id])
}

model Attachment {
  id           String   @id @default(uuid())
  taskId       String
  task         Task     @relation(fields: [taskId], references: [id])
  uploadedById String
  uploadedBy   User     @relation(fields: [uploadedById], references: [id])
  fileName     String
  mimeType     String
  sizeBytes    Int
  storageKey   String
  createdAt    DateTime @default(now())
}

model ActivityLog {
  id        String       @id @default(uuid())
  taskId    String
  task      Task         @relation(fields: [taskId], references: [id])
  actorId   String
  actor     User         @relation(fields: [actorId], references: [id])
  type      ActivityType
  metadata  Json?
  createdAt DateTime     @default(now())
}

model Notification {
  id             String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  recipientId    String
  recipient      User     @relation(fields: [recipientId], references: [id])
  type           NotificationType
  payload        Json
  isRead         Boolean  @default(false)
  createdAt      DateTime @default(now())
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  tokenHash String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
}
```

---

## Suggested API Endpoint List (reference)

Grouped by domain; all protected routes require a valid JWT and enforce the per-entity rules above.

**Auth:** `POST /auth/signup` (Owner+org), `POST /auth/verify-email`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/first-login/reset-password`, `POST /auth/forgot-password`, `POST /auth/reset-password`.

**Users (Admin/Owner):** `GET /users`, `POST /users` (create PM/Collaborator), `PATCH /users/:id` (role/details), `POST /users/:id/deactivate` (PM → transfer dialog), `POST /users/:id/resend-invite`.

**Org (Owner):** `GET /organization`, `PATCH /organization`, `POST /organization/admins`, `DELETE /organization/admins/:id`.

**Projects (PM/Owner):** `GET /projects` (own/member-of), `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `POST /projects/:id/archive`, `POST /projects/:id/unarchive`, `POST /projects/:id/transfer`, `GET /projects/:id/members`, `POST /projects/:id/members`, `DELETE /projects/:id/members/:userId` (reassignment dialog).

**Columns / Labels:** `GET/POST/PATCH/DELETE /projects/:id/columns`, `GET/POST/PATCH/DELETE /projects/:id/labels`.

**Tasks:** `GET /projects/:id/tasks`, `POST /projects/:id/tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, `DELETE /tasks/:id`, `PATCH /tasks/:id/move` (column change; gated check), `POST /tasks/:id/assignees`, `DELETE /tasks/:id/assignees/:userId`, `POST/PATCH/DELETE /tasks/:id/checklist`, `POST /tasks/:id/labels`, `DELETE /tasks/:id/labels/:labelId`.

**Comments / Attachments:** `GET/POST /tasks/:id/comments`, `DELETE /comments/:id`, `GET/POST /tasks/:id/attachments` (signed-URL flow), `DELETE /attachments/:id`.

**Activity / Notifications:** `GET /tasks/:id/activity`, `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`.

**Search:** `GET /search?q=` (scoped to caller's accessible projects).

**Real-time:** Socket.IO gateway (JWT-authenticated on connect; user joins a private room; server emits notifications to `recipientId`'s room).

---

*This Backend Schema is the locked data baseline. The Implementation Plan (document 6) sequences how it, the API, the auth, the real-time layer, and the UI are built and deployed.*
