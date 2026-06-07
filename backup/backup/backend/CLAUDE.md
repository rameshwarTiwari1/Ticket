# CLAUDE.md — Backend

This file provides guidance to Claude Code (claude.ai/code) when working in `backend/`.
See the root `CLAUDE.md` for the system overview and `../README.md` for business rules.

## Stack

Node.js (CommonJS) · Express 5 · PostgreSQL (`pg` pool) · JWT auth · Joi + express-validator ·
Multer (uploads) · Nodemailer (Office 365) · Winston (logging, underused).

## Commands

```powershell
npm install        # install deps
npm start          # runs Server.js → http://localhost:3008 (PORT env), else 5000
# nodemon is a devDependency but no "dev" script exists; run manually:
npx nodemon Server.js
```

There are **no build, lint, or working test scripts** (`npm test` is the placeholder
`echo "Error: no test specified" && exit 1`). If you add tests, also add the runner config.

## Configuration

All config is read from `.env` via `dotenv` (already committed — contains real DB password, JWT
secret, and two SMTP account passwords; treat as compromised):

- `DB_USER / DB_HOST / DB_NAME / DB_PASSWORD / DB_PORT` → consumed in `config/db.js` (pg `Pool`).
- `PORT` (3008 in `.env`; `Server.js` falls back to 5000).
- `JWT_SECRET` → used to sign/verify 5h tokens.
- `SMTP_HOST / SMTP_PORT` plus **two** account pairs: `SMTP_USER_HC/SMTP_PASS_HC` (Hansa Cequity)
  and `SMTP_USER_HD/SMTP_PASS_HD` (Hansa Direct / Autosense). Email routing is **per-organization**
  — see `utils/mailer.js`.

CORS whitelist (origins on `192.168.5.39`, `192.168.5.245`, `localhost`) is in `App.js`.

## Layered architecture

Request flow: **`routers/` → `middlewares/*Validate.js` (+ `auth.js`) → `controllers/` →
`models/` → PostgreSQL**.

- `Server.js` — entry point, starts the listener.
- `App.js` — Express app: CORS, body parsing, static `/uploads`, and route registration. This is
  the index of which router is mounted at which `/api/...` base path.
- `routers/*` — one router per resource; mounts middleware and maps verbs to controller functions.
- `controllers/*` — request/response handling + business logic.
- `models/*` — all SQL lives here, using **parameterized queries** (no string interpolation of
  user input). Reuse the shared `TICKET_SELECT` / `TICKET_JOINS` constants in `ticketModel.js`
  rather than rewriting joins.
- `middlewares/auth.js` — verifies JWT, sets `req.user` (`{ userId, org_id }`).
- `utils/authorize.js` — team-based write authorization (allows only `admin`, `it services`,
  `dba`). `utils/mailer.js` — org-aware email. `utils/notification.js` — minimal in-app
  notification helper (no endpoints yet).

## API surface (base `/api`)

Routers are mounted in `App.js`. Key ones:

| Base path                  | Router                  | Notes |
|----------------------------|-------------------------|-------|
| `/api/auth`                | `auth.routes.js`        | `send-otp`, `verify-otp`, `register`, `reset-password` |
| `/api/users`              | `userRoutes.js`         | `login` (public), CRUD (admin/IT only), `reassign`, `delete-with-reassign/:id` |
| `/api/tickets-generate`    | `ticketRoutes.js`       | Ticket CRUD + `approve/:token` (public), `assign-ticket`, `user/:userId`, `assigned-team/:teamName`, comments |
| `/api/teams`               | `teamRoutes.js`         | `public` list (no auth) + CRUD |
| `/api/organizations`       | `organizationRoutes.js` | `public`, `by-name/:name`, CRUD |
| `/api/locations`           | `locationRouter.js`     | CRUD |
| `/api/wings`               | `wingRoutes.js`         | CRUD |
| `/api/issues`              | `issueRoutes.js`        | CRUD (issues map to a handling team via `mapped_team_id`) |
| `/api/clients`             | `clientRoutes.js`       | CRUD + `resolve` (all currently unauthenticated) |
| `/api/types`               | `typeRoutes.js`         | CRUD |
| `/api/ticket-status`       | `statusRouter.js`       | CRUD (Joi-validated) |
| `/api/otp`                 | `otpRoutes.js`          | `send`, `verify` |

## Data model (tables, prefix `T_`)

`T_USER`, `T_TEAMS` (has `location_id`), `T_TICKETS`, `T_ORGANIZATION` (has `location_id`),
`T_LOCATIONS`, `T_WINGS` (has `location_id`), `T_TYPES`, `T_ISSUES` (`mapped_team_id`),
`T_CLIENTS`, `ticket_status`, `T_EMAIL_OTP`, `T_COMMENTS`. There is no migrations folder — the
schema is assumed to already exist in the database; infer columns from the SQL in `models/`.

### Ticket specifics (`models/ticketModel.js`)
- `ticket_number` = `TKC<YYYYMMDDHHMMSS>` (`generateTicketNumber`).
- `sla_due_at` computed from priority (`calculateSLA`): High +4h, Medium +8h, Low +1 day.
- On create, `org_id`/`location_id` are derived from the **organization's** location
  (`T_ORGANIZATION.location_id`), *not* directly from the creator's `location_id` — keep this in
  mind when reasoning about the README's "creation location" rule.
- **Approval workflow:** tickets start `approval_status='pending'` with a UUID `approval_token`.
  `GET /api/tickets-generate/approve/:token?action=approved|not_approved` (no auth) records the
  decision, stamps `approved_by`/`approved_at`, and nulls the token (single-use). Assignment is
  only allowed once approved.

## Gotchas / non-obvious behavior

- **Schema migration required.** The current code assumes `migrations/001_ticketing_rules.sql`
  has been applied (adds `t_user.role`, `t_approvers`, `t_user_location_history`, `notifications`,
  SLA columns, `t_tickets.approver_email`, seeded statuses). Run it before starting the server.
- **Auth is now bcrypt end-to-end.** Login (`userController.js`) verifies with `bcrypt.compare`
  and lazily upgrades any legacy plaintext password on first successful login;
  registration hashes. `scripts/migrate_passwords.js` hashes leftover rows.
- **Visibility is enforced server-side** via `utils/access.js#ticketVisibilityScope` and the
  `canView/Assign/Edit/WorkTicket` helpers — used by `getAllTickets`, `getTicketsByLocation`,
  `getTicketsByAssignedTeam`, and the `getById`/`update`/`assign` controllers. When adding a new
  ticket-list endpoint, route it through `ticketVisibilityScope` so the Golden Rule holds.
- **Roles live in the JWT** (`{ userId, role, org_id, team_id, location_id }`), set at login.
  Existing sessions must re-login to pick up `role`. Gate routes with
  `middlewares/rbac.js` (`requireAdmin` / `requireManagerOrAdmin`).
- **Ticket creation**: location is stamped from the *creator's* `location_id` (immutable);
  team is auto-routed from `issue.mapped_team_id` → that team at the ticket's location; status
  starts at *Pending Approval*; the approver is auto-selected from `t_approvers`. A creator with
  no `location_id`, or an issue with no team mapping, will fail creation by design.
- **No approver configured ⇒ no approval email** (ticket stays Pending Approval). Seed
  `t_approvers` per location+team plus a location default.
- `wing_id` updates are still commented out in `updateTicket` (cannot change a ticket's wing).
- Models/controllers remain noisy with `console.log` debug output; prefer the Winston logger.
