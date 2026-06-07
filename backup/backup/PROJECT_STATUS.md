# Project Status — Ticket Management System

Assessment of the codebase against the business rules in `README.md`, as of 2026-06-07.
Three sections: **Implemented**, **Known Bugs**, **To Be Implemented**. File references use
`backend/` and `frontend/` roots.

> **⚑ Implementation update (2026-06-07) — branch `feature/ticketing-rules-implementation`.**
> The rules in `README.md` have now been implemented. See the
> **"Implementation update"** section at the bottom for exactly what changed, the new files,
> and the required deployment steps (DB migration + password script). The "Known Bugs" and
> "To Be Implemented" sections below describe the *pre-implementation* state and are kept for
> history; resolved items are called out in the update section.

---

## 1. Implemented (working)

### Authentication & onboarding
- Email/password **login** returning a JWT (5h), stored in `localStorage`, auto-attached to
  requests. (`backend/controllers/userController.js` login, `frontend/services/auth.*`)
- **OTP-based registration** and **OTP-based password reset** (3-step flows on the frontend).
  (`backend/controllers/auth.controller.js`, `frontend/components/registration`, `.../forgotPassword`)
- **Session timeout** after 5 min inactivity (frontend `auth.service.ts`).
- Route protection for `/dashboard` via `AuthGuard`.

### Tickets (core)
- Create ticket with auto `ticket_number` (`TKC<timestamp>`), priority-based `sla_due_at`, and
  file attachment (Multer, 5 MB, type-validated). (`backend/models/ticketModel.js`)
- Full ticket CRUD; list by user (created or assigned); list by assigned team.
- **Approval workflow**: pending → email link with single-use UUID token →
  `approve/:token?action=approved|not_approved`, records approver + timestamp; assignment gated on
  approval.
- Ticket comments (add/list); IT-services/admin restricted on add.

### Supporting entities
- Full CRUD for Users, Teams, Organizations, Locations, Wings, Types, Issues, Clients, Statuses.
- Org-aware **email notifications** via two SMTP accounts (Hansa Cequity vs Hansa Direct/Autosense).
- Team-based write authorization (`admin`, `it services`, `dba`) via `backend/utils/authorize.js`.

### Frontend dashboard
- Stats overview with date-range filtering; ticket list with table/card views, search, pagination,
  status tabs; create/edit/delete/assign ticket; admin-only Users & Teams management; org-switcher
  for Admin/Manager. Role flags derived from `team_name`.

### Role rules — current coverage vs README
| README role | Status |
|-------------|--------|
| **Admin** — all tickets/orgs, org-switch, manage users/teams | ✅ Implemented (UI + API) |
| **Employee** — only tickets assigned to them | ✅ `getTicketsByUser` filters by `created_by`/`assigned_to` |
| **User (requester)** — create + view own tickets | ✅ same query path |
| **Manager** — assigned **location** only, but org-switch all | ⚠️ Partial — see Bugs / To-Do |

---

## 2. Known Bugs

### 🔴 Critical

1. **Password auth is broken and self-contradictory.**
   - Login compares plain text: `password === user.password_hash`
     (`backend/controllers/userController.js:45`, bcrypt commented at :44).
   - Registration stores plain text: `const hashedPassword = password;`
     (`backend/controllers/auth.controller.js:131`).
   - But **password reset bcrypt-hashes** the new password
     (`backend/controllers/auth.controller.js:165`).
   - **Effect:** any user who resets their password is then locked out (login compares plaintext to
     a bcrypt hash). All stored passwords are plaintext. Fix must be done consistently across
     login + registration + reset (and likely a data migration).

2. **Location-based visibility is not enforced server-side** (violates README #5 and #7).
   - `getAllTickets` filters only by `org_id` (`backend/models/ticketModel.js:217`).
   - `getTicketsByAssignedTeam` filters by team + org but **not** `location_id`
     (`backend/models/ticketModel.js:434-435`). A team in Location B will see Location A's tickets
     for the same team name — exactly what README #5 forbids.
   - Visibility is only filtered in the Angular dashboard
     (`applyLocationVisibilityFilter()`), which is bypassable by calling the API directly.

### 🟡 Functional

3. **Manager location scoping incomplete.** README #2 says a Manager sees only their assigned
   location's tickets. With no server-side `location_id` filter, this relies entirely on
   client-side logic. Needs backend enforcement keyed off `req.user`'s location.

4. **Ticket `wing_id` cannot be updated.** The `wing_id` column is commented out of the
   `updateTicket` query (`backend/models/ticketModel.js:339,355`).

5. **Ticket creation location is derived from the organization, not the user.** `createTicket`
   sets `location_id` from `T_ORGANIZATION.location_id`
   (`backend/models/ticketModel.js:138-144`). README #1.5/#6 describe location as the *creator's*
   location, and #6 (transfer scenario) implies per-user location history. Confirm intended source
   of truth.

6. **Several resource routes are unauthenticated.** All `clients` routes and some `teams`/`orgs`
   reads are public (`GET /public`, `clients` CRUD). Confirm whether that's intended.

7. **Stale failing unit test.** `frontend/src/app/app.spec.ts` asserts removed template text
   (`Hello, Frontend`); `npm test` fails by default.

### 🟢 Minor / hygiene
- Pervasive `console.log` debug output in backend models/controllers and frontend dashboard.
- Dead backup files committed beside live code: e.g.
  `backend/controllers/userController_backup29.js`, `backend/models/ticketModel.js.backup`,
  `backend/models/ticketModel_backup_20260601.js`, `backend/models/usermodal.bkup.js`,
  `backend/routers/ticketRoutes.js.backup`, `frontend/src/app/models/Models_backup_1062026.ts`.
- Secrets committed in `backend/.env` (DB, JWT, SMTP). Treat as compromised; rotate.
- Minor Joi typo `.optional` (missing `()`) in `backend/validators/ticketValidator.js` (~:30).
- Inconsistent API response shapes (`{message,data}` vs raw arrays) across resources.
- Unused deps/imports: Chart.js, most of Angular Material.
- Hardcoded mappings/email in `frontend/.../dashboard-list.Mapping.ts`.

---

## 3. To Be Implemented (gaps vs README)

1. **Server-side location-scoped ticket queries** — the central README requirement. Every ticket
   list/read path must filter by `location_id` according to the caller's role/location, so Location
   A tickets never surface for Location B (even same team). (References README #5, #7.)

2. **Backend role/permission enforcement** beyond the coarse team check. Encode Admin / Manager /
   Employee / User capabilities (who can reassign, who can edit, who can only view own) at the API
   layer; today much of this is UI-only. Consider wiring the unused
   `frontend/services/manager.guard.ts` and adding matching backend checks.

3. **Location-change / transfer handling** (README #6): when a user moves Location A → B, old
   tickets stay with Location A and only new tickets follow Location B rules. Needs a defined model
   for user-location history (current schema ties location via org).

4. **Notifications feature** — backend helper exists (`backend/utils/notification.js`) but there
   are no list/mark-read endpoints, and the frontend UI is stubbed/commented out.

5. **Reports/analytics** — Chart.js is a dependency but no charts/reporting screen exists; dashboard
   stats are simple counts.

6. **Test & lint tooling** — no working backend tests/lint; frontend test scaffold is broken. Add a
   runner + at least smoke tests for auth and ticket visibility (the highest-risk areas).

---

### Suggested priority order
1. Fix password hashing end-to-end (login + register + reset) — blocks correct, secure auth.
2. Enforce location-based ticket visibility server-side — the core business rule.
3. Backend role/permission enforcement (Manager location scope, reassign restrictions).
4. Location-transfer handling.
5. Hygiene: remove backup files & debug logs, rotate secrets, fix the broken spec.
6. Then optional features: notifications, reports.

---

## Implementation update — 2026-06-07 (branch `feature/ticketing-rules-implementation`)

The README rules and architecture have been implemented. Below is what changed, what's done,
what still needs doing, and **how to deploy** (DB migration is required before the new code runs).

### ✅ Resolved / built
| Rule / gap | What was done | Key files |
|---|---|---|
| Password auth (critical bug) | Login uses `bcrypt.compare`; legacy plaintext is verified once then auto-upgraded to a hash; registration now hashes; reset already did. One-time migration script added. | `controllers/userController.js`, `controllers/auth.controller.js`, `scripts/migrate_passwords.js` |
| Roles (Admin/Manager/Employee/User) | New `role` column; JWT now carries `role`, `team_id`, `location_id`; `requireRole`/`requireAdmin`/`requireManagerOrAdmin` middleware; Admin endpoint to promote to Manager. | `constants/roles.js`, `middlewares/rbac.js`, `routers/userRoutes.js` |
| Golden Rule: location visibility (§2,§5,§7) | Central `ticketVisibilityScope` + `canView/Assign/Edit/WorkTicket`; `getAllTickets` and `getTicketsByAssignedTeam` now scope by role + location server-side; `getById`/assign/update enforce it. | `utils/access.js`, `models/ticketModel.js`, `controllers/ticketController.js` |
| Per-user location + transfer (§5,§8) | Ticket location stamped from the **creator's** current location (immutable); user transfer endpoint records history in `t_user_location_history`. | `models/userModel.js`, `models/ticketModel.js`, migration |
| Auto-routing by category (§7) | `resolveTeamForIssueAtLocation` maps issue→team→the team instance at the ticket's location. | `models/ticketModel.js` |
| Approver registry + auto-select (§6) | `t_approvers` table; Admin CRUD API + Angular screen; approver auto-resolved at creation (location+team, location default fallback); approval email goes to the resolved approver. | `models/approverModel.js`, `controllers/approverController.js`, `routers/approverRoutes.js`, `frontend/.../approver/` |
| Lifecycle + transitions (§4) | Status constants + allowed-transition map; new tickets start *Pending Approval*; approval advances to *Approved*/*Rejected*; invalid transitions rejected; assignment blocked until approved. | `constants/roles.js`, `models/ticketModel.js`, `controllers/ticketController.js` |
| SLA breach (§9) | `sla_breached` flag; `slaChecker` marks breaches and notifies assignee + that team's Manager; runs on an interval + admin `GET /api/tickets-generate/sla/check`. | `utils/slaChecker.js`, `Server.js` |
| Notifications (§10) | List / mark-read endpoints + Angular service. | `utils/notification.js`, `routers/notificationRoutes.js`, `frontend/.../notification.service.ts` |
| `.optional` Joi bug | Fixed. | `validators/ticketValidator.js` |

Both apps compile cleanly: backend `node --check` + full `require('./App')` load passes; frontend
`ng build` succeeds.

### ⚠️ Still to do (not done in this pass)
- **Dashboard UI integration** of: a "Promote to Manager" / "Transfer location" control in the
  Users tab, a notifications bell, and an SLA-breach badge. The **services exist**
  (`user.service.ts`, `notification.service.ts`) and the standalone **Approver screen** is wired at
  `/approvers`; the 1700-line `dashboard-list.component.ts` was intentionally not modified to avoid
  regressions — wire these in next.
- **Apply the DB migration** (see below) — the new code assumes the new columns/tables exist.
- **Seed the approver registry** via `/approvers` (Admin) — until then tickets get a null approver
  and no approval email is sent.
- **Assign roles/locations** to existing users (migration backfills a best-effort guess from team).
- Hygiene: remove committed `*.backup` files, rotate the secrets in `.env`, fix `app.spec.ts`.
- Reports/analytics and automated tests remain open.

### 🚀 Deployment steps (run in order)
1. **Back up the database.**
2. **Apply the migration** (adds `role`, history table, `t_approvers`, `notifications`, SLA columns,
   `approver_email`, and seeds statuses):
   ```
   psql "host=192.168.5.39 port=5432 dbname=Ticketing_Tool_Hansa user=hansa_user" \
     -f backend/migrations/001_ticketing_rules.sql
   ```
3. **Hash any leftover plaintext passwords:** `node backend/scripts/migrate_passwords.js`
   (login also upgrades them lazily, so this only covers users who haven't logged in).
4. **Set roles & locations:** mark your Admin(s) `role='admin'`, ensure every user has a
   `location_id`, and promote Managers via `PUT /api/users/:id/role { "role": "manager" }`.
5. **Seed approvers** at `/approvers` (one per location+team, plus a location default).
6. Restart the backend (`npm start`) and rebuild/redeploy the frontend (`npm run build`).

### New API endpoints
- `PUT  /api/users/:id/role` — Admin: set a user's role.
- `PUT  /api/users/:id/transfer` — Admin: change a user's location (records history).
- `GET  /api/users/assignable` — Manager/Admin: assignable employees (own team+location).
- `GET/POST/PUT/DELETE /api/approvers` — Admin (GET also Manager): approver registry.
- `GET/PUT /api/notifications`, `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`.
- `GET  /api/tickets-generate/sla/check` — Admin: run SLA breach scan on demand.
- `GET  /api/tickets-generate/location/:locationId` — location-scoped list (own location / admin).

---

## Audit & bug-fix pass — 2026-06-07 (dashboard role flows + full bug sweep)

Audited every role end-to-end (admin / manager / employee / user) and swept both tiers. Fixes:

**Backend**
- **CRITICAL:** `addUser` never persisted `role` → admin-created staff silently became
  requesters. Now persists role (default `employee`); `updateUser` updates role too; the user
  create/edit form has a **Role** selector.
- **HIGH:** ticket **assignment** now validates the assignee belongs to the ticket's team +
  location (was: any user id accepted). Bulk **`/users/reassign`** restricted to Admin.
- `/user/:userId` and `/location/:locationId` are ownership/role-scoped (added the missing
  location endpoint the dashboard called).
- Approval email now goes to the **auto-selected approver** (was still going to the
  requester-typed email). Comment permission now matches README §3 (admin/manager/assigned
  employee/owner) instead of "IT Services only".
- `update` owner-check uses `created_by_id` (was a fragile name match). `auth.js` returns **401**
  (not 403) so the frontend auto-logs-out on token expiry. `created_by` taken from the JWT.
- **Lifecycle completed:** requester can **Reopen** their Resolved/Closed ticket; a job
  **auto-closes** Resolved tickets after `AUTO_CLOSE_DAYS` (default 3). Approval advances status.
- `status_name`/`team_name` made optional in the create validator (server derives them).

**Frontend (dashboard)**
- Role detection now uses the authoritative `role` field; added `canManageTickets`
  (assign) and `canEditTickets` (edit) getters. **Assign** is Admin/Manager only; **Edit** is
  Admin/Manager (full) + Employee (status-only); **Users/Teams** tabs are Admin-only.
- Requester can now comment on **their own** ticket and **Reopen** it.
- User form gained a Role selector (admin sets role at create/edit).

Both tiers verified: backend `require('./App')` loads clean; frontend `ng build` succeeds.

### Root README.md — implementation coverage
All sections of `README.md` are now implemented in code: §2 visibility (server-side scope), §3
roles/permissions (RBAC + dashboard gating), §4 lifecycle (transitions + reopen + auto-close),
§5 location stamping, §6 approver registry + auto-select, §7 auto-routing + scoped assignment,
§8 transfer history, §9 SLA breach, §10 notifications, §12 multi-org. The §13 items remain
**configuration/decisions** (approver data to seed, auto-close=3d, reopen window, priority
ownership) and the documented operational edge-cases (a–d) — not missing code.

---

## Full end-to-end audit (all roles) — 2026-06-08

Ran three parallel audits (onboarding/auth, ticket-creation/approval, assignment/dashboard) and
fixed every confirmed bug. Highlights:

**Blockers (would break core flows)**
- **No UI to set a user's location** → with location null, *nobody* could create a ticket
  (creation requires the creator's location). Added a required **Location** field to the
  user create/edit form (`saveUser` sends `location_name`, pre-filled on edit). This also makes
  **promote-to-Manager** and **transfer-location** doable via the edit form.
- **Approval email link used port 5000** while the server runs on 3008 → links were dead. Added
  `APP_BASE_URL=http://192.168.5.39:3008` to `.env` and fixed the mailer fallback to use `PORT`.
- **Validator 400 for Hansa Direct/Autosense** tickets (`desk_number` was an unknown key) — added
  to the create schema.

**Role/flow correctness (frontend was team-based, backend is role-based)**
- Dashboard ticket loading now branches by **role** (admin→all, manager→location, employee/user→own)
  instead of `teamName` — real Managers were never matched before.
- Removed the buggy client-side location filter (it read `created_at_location_id`, which the API
  never returns, and could blank lists). Visibility is trusted from the server scope.
- **Assign modal** now loads its user list from `GET /api/users/assignable` (the ticket's
  team+location) — previously it used a hardcoded team list, so valid assignments 400'd or showed
  no one. Assign no longer sends `org_name`; `assignTicket` no longer overwrites the immutable
  `org_id`.
- Status **counts/tabs** now include Pending Approval/Approved/On Hold (Paused = On Hold, was
  wrongly = In Progress) so the numbers reconcile.
- **Issue dropdown is DB-driven** now (was hardcoded-gated) → admin-added issues appear and
  auto-route. SLA-breach badge added; `'Reopend'` typo fixed; "Approved by" now shows the approver.

Both tiers verified after fixes: backend loads clean; frontend `ng build` succeeds.

**Still intentional / not changed:** the manual "Assigned To (team)" picker on the create form is
vestigial now that routing is automatic (the IT-team *info* email keys off it; the *approval* email
is correct). Notifications bell is still not in the dashboard (service exists). These are noted, not
bugs that break a flow.
