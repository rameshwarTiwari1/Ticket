# CLAUDE.md — Frontend

This file provides guidance to Claude Code (claude.ai/code) when working in `frontend/`.
See the root `CLAUDE.md` for the system overview and `../README.md` for business rules.

## Stack

Angular **21** (standalone components, SSR-capable) · TypeScript 5.9 · RxJS · Bootstrap 5 +
Angular Material + Font Awesome · Chart.js (imported, unused) · Vitest for tests.
Package manager pinned to `npm@11.6.4`.

## Commands

```powershell
npm install                         # install deps
npm start                           # ng serve → http://localhost:4200
npm run build                       # production build → dist/  (SSR enabled in angular.json)
npm run watch                       # dev build, watch mode
npm test                            # ng test (Vitest)  — NOTE: app.spec.ts is stale and fails
ng test --include='**/<name>.spec.ts'   # run a single spec
npm run serve:ssr:Frontend          # serve the SSR build (node dist/Frontend/server/server.mjs)
```

Prettier config is inline in `package.json` (`printWidth: 100`, `singleQuote: true`, Angular HTML
parser). Match it when editing.

## Architecture

- **Bootstrap:** `src/main.ts` → standalone `AppComponent` (`src/app/app.ts`, just a
  `<router-outlet>`). Providers (HTTP client, interceptor, hash-location router) are in
  `src/app/app.config.ts`.
- **Routing:** `src/app/app.routes.ts`. **Hash-based** URLs (`#/dashboard`). Routes:
  `/login`, `/register`, `/forgot-password` (all public), `/dashboard` (guarded by `AuthGuard`),
  `/` and `**` → redirect to `/login`. There is effectively **one feature screen** (dashboard);
  everything else is auth flows.
- **State:** no NgRx. Auth state is a `BehaviorSubject<User>` in `services/auth.service.ts`,
  persisted to `localStorage` (`token`, `user`), exposed as `currentUser$`.
- **API access:** `environments/environment.ts` sets `apiUrl = http://localhost:3008/api`. Each
  resource has a service in `services/*.service.ts` calling `${apiUrl}/<resource>`.
  `auth.interceptor.ts` injects `Authorization: Bearer <token>` and logs out on 401.
- **Models:** all TypeScript interfaces live in `src/app/models/Models.ts`.
- **Session timeout:** `auth.service.ts` auto-logs-out after **5 minutes** of inactivity
  (mouse/key/scroll/touch listeners).

### Role-based UI (the important part)

`services/auth.guard.ts` only checks "logged in". Role differentiation happens **inside the
dashboard component**, not via route guards:

- `components/dashboard/dashboard-list.component.ts` → `setRoleFlags()` derives role booleans from
  `loggedInUser.teamName` (`Admin`, `IT Services`, `Manager`, `DBA`, `Employee`, `User`).
- `applyLocationVisibilityFilter()` enforces the README's location/role visibility rules
  **client-side** (the backend does not fully enforce them — see `../PROJECT_STATUS.md`).
- The org-switcher dropdown (Admin/Manager only) re-filters tickets by `org_id`.
- `dashboard-list.Mapping.ts` holds hardcoded org/issue/team mappings (including a hardcoded DBA
  email) — a known maintainability gap; ideally load from the backend.

`services/manager.guard.ts` exists but is **not wired into any route**.

The dashboard is large (`dashboard-list.component.{ts,html,css}`, ~1700/1600/2750 lines) and holds
nearly all functionality: stats overview, ticket list (table/card views, search, pagination,
filters), create/edit/delete/assign ticket, comments, and admin-only Users & Teams CRUD tabs.

## Gotchas

- `localStorage` access is guarded with `isPlatformBrowser` because SSR is enabled — keep that
  guard on any new browser-only access.
- `app.spec.ts` asserts old template text (`Hello, Frontend`) and will fail; update or remove it
  before relying on CI.
- Notifications UI is stubbed/commented out; Chart.js and most of Angular Material are unused.
- `Models_backup_1062026.ts` is a dead backup — ignore it; edit `Models.ts`.
