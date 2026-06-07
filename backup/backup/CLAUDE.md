# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A **multi-tenant, location-based IT ticket management system** for the Hansa group of companies
(organizations: **Hansa Direct**, **Hansa Cequity**, **Autosense**). Users raise support tickets;
managers/teams (IT Service, DBA, Help Desk) triage, approve, assign and resolve them. Access to
tickets is governed by **role**, **organization**, and — most importantly — **the location a ticket
was created in**.

The authoritative business rules live in `README.md` (root). Read it before touching any
access-control, ticket-routing, or visibility logic. The current implementation status of those
rules (done / buggy / missing) is tracked in `PROJECT_STATUS.md`.

## Repository layout

```
backup/backup/
├── README.md            # Business requirements: access & location-visibility rules (source of truth)
├── PROJECT_STATUS.md    # Implemented / known bugs / to-be-implemented (vs README)
├── backend/             # Node.js + Express + PostgreSQL API   → see backend/CLAUDE.md
└── frontend/            # Angular 21 SPA (SSR-capable)          → see frontend/CLAUDE.md
```

> Note: the working tree is nested under `backup/backup/` and contains many `*.backup`,
> `*.bkup`, `*_backup_*` and `*_backup29` files committed alongside live code. These are dead
> snapshots — **do not edit or import them**; rely on git history instead. See `PROJECT_STATUS.md`.

## Architecture (big picture)

- **Frontend (Angular 21, `localhost:4200`)** talks to the **backend REST API
  (`localhost:3008/api`)** over HTTP. The base URL is in
  `frontend/src/app/environments/environment.ts`.
- **Auth** is JWT-based. On login the backend returns `{ token, user }`; the token (5h expiry,
  payload `{ userId, org_id }`) is stored in `localStorage` and auto-attached to every request by
  `auth.interceptor.ts`. The backend `middlewares/auth.js` verifies it and sets `req.user`.
- **Roles are not a column.** A user's effective role is *inferred* from their `team_name`
  (`Admin`, `IT Services`/`Manager`, `DBA`, `Employee`, `User`) plus `org_id` and `location_id`.
  The frontend derives boolean role flags from `team_name`; the backend authorizes writes via
  `utils/authorize.js` (only `admin`, `it services`, `dba` teams may mutate most resources).
- **The four core entities that drive visibility** are **Organization → Location → Team/Wing →
  User**, and every **Ticket** carries `org_id`, `location_id`, `assigned_team_id`. A ticket's
  `location_id` is meant to be **immutable** and to gate who can see it.

### The central rule to keep in mind

Per `README.md`, ticket visibility must depend on **(creation location) + (assigned team) +
(user role)**, and a ticket created in Location A must **never** appear under Location B — even if
the same team (e.g. "IT Service") exists in both. As of now this is **only partially enforced**
(largely client-side). When adding any "list tickets" capability, scope it by `location_id`
server-side. See `PROJECT_STATUS.md` → "Location-based visibility".

## Running the system

Two processes. Start the backend first (frontend expects it on port 3008).

```powershell
# Backend  (needs a reachable PostgreSQL — see backend/.env)
cd backend
npm install
npm start                      # Server.js → http://localhost:3008  (defaults to 5000 if PORT unset)

# Frontend
cd frontend
npm install
npm start                      # ng serve → http://localhost:4200
```

A PostgreSQL database (`Ticketing_Tool_Hansa`) and Office 365 SMTP access are required for full
functionality (login, email notifications, approval links). See `backend/CLAUDE.md`.

## Conventions worth knowing

- Backend resolves human-readable names → IDs at write time (e.g. `team_name` → `team_id` via
  `getIdByName` in `models/ticketModel.js`). The frontend generally sends names, not IDs.
- There is **no test suite or linter wired up** on the backend; the frontend has Vitest but the
  default `app.spec.ts` is stale and fails. Don't assume `npm test` is green.
- Secrets are currently committed in `backend/.env`. Treat them as compromised; do not add more.
