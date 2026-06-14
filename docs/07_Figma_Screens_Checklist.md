# Nuvela — Figma Screen Checklist

Complete screen checklist for a Figma prototype, derived from the locked planning docs. This list ignores the existing screen checklist and replaces it with a new, role-grouped version.

## Theme Coverage

- [x] Light mode variants for every listed screen and state
- [x] Dark mode variants for every listed screen and state

## Public / Logged Out

- [x] Splash screen (`/`)
- [x] Login (`/login`)
- [x] Signup (`/signup`)
- [x] Verify email pending (`/verify-email/pending`)
- [x] Verify email result (`/verify-email`)
- [x] Forgot password (`/forgot-password`)
- [x] Reset password (`/reset-password`)
- [x] Plans (`/plans`)

## Shared Authenticated Screens

- [x] Dashboard (`/dashboard`) with role-based variants
- [x] Notifications history (`/notifications`)
- [x] Search results (`/search`)
- [x] Account settings (`/settings/account`)
- [x] First-login forced password reset (`/first-login/reset-password`)

## Owner

- [x] Organization settings (`/settings/organization`)
- [x] Owner dashboard state (same route as shared dashboard, owner variant)
- [x] Owner access to all Admin screens
- [x] Owner access to all Project Manager screens

## Admin

- [x] User management (`/users`)
- [x] Create user modal
- [x] Edit user modal
- [x] Resend invite confirmation state
- [x] Deactivate PM transfer flow
- [x] Admin dashboard state (same route as shared dashboard, admin variant)

## Project Manager

- [x] Projects list (`/projects`)
- [x] Create project modal
- [x] Project board (`/projects/:id`)
- [x] Task detail side panel (`/projects/:id/tasks/:taskId`)
- [x] Project settings (`/projects/:id/settings`)
- [x] Archived projects (`/projects/archived`)
- [x] Member removal reassignment dialog
- [x] Project transfer dialog
- [x] Label management modal/dialog
- [x] Project board empty state
- [x] Project board read-only archived state

## Collaborator

- [x] My projects list (`/projects`, filtered invited-project view)
- [x] Project board (`/projects/:id`, collaborator variant)
- [x] Task detail side panel (`/projects/:id/tasks/:taskId`, collaborator variant)
- [x] Collaborator board locked Completed-column state
- [x] Collaborator task empty state

## System / Fallback

- [x] Forbidden screen (`/403`)
- [x] Not found screen (`/404`)
- [x] Generic error boundary (`/error`)

## Cross-Cutting States To Prototype

- [x] Empty dashboard state for new Owner
- [x] Empty dashboard state for Collaborator with no tasks
- [x] Empty dashboard state for Admin with no team members
- [x] Empty projects list state
- [x] Empty archived projects state
- [x] Empty notifications state
- [x] Empty search results state
- [x] Empty board column state
- [x] Empty task comments state
- [x] Empty task attachments state
- [x] Empty project members state
- [x] Loading skeletons for dashboard, lists, board, task detail, notifications, and search
- [x] Button loading state with inline spinner
- [x] Render cold-start "waking up" state
- [x] Network failure toast state
- [x] Validation error state
- [x] Session expired redirect state
- [x] Expired temp-password state
- [x] Invalid or expired verification link state
- [x] Duplicate email error state
- [x] Upload rejected state
- [x] Only-PM-blocked completion state
- [x] Read-only archived project state
