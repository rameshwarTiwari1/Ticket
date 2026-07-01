# Implementation Plan — 9-Task Spec (Hansa Ticketing)

Source: `implementation_spec.md` (team). Baseline: this repo after `da8387e`
(team's newRecentCode merged in; my manager-visibility fix + prod SLA kept).

**Ground rules for every task**
- This repo (`backup/backup`, git root `D:\Mine\code\Code`) is the source of truth; team pulls fresh.
- Don't break the running Docker stack. After each task: `node --check` backend, confirm frontend
  bundle builds, run a quick live test against `localhost:3008`, then commit (main, no co-author).
- One task = one commit. Keep infra/test divergences (Server.js 60s, environment.ts localhost, prod SLA).

**Decisions I'm proceeding with (override anytime):**
- **2.1 recipient set** = ticket raiser + assignee + **assignee's team manager** + org **Admin(s)** +
  **team mailbox** (`getTeamEmailConfig`) + the ticket's `additional_email` CCs.
- **1 manager scope** = own team + tickets they raised (already implemented; not "all teams at location").
- **9 stale approval link** = show a friendly "request was updated / superseded" page.
- **6 additional_email** = multiple, comma-separated (existing column, single field).
- **5.1 roster** = present + full-day only for now (half-day excluded until confirmed).

---

## Build order & per-task plan

### Task 3 — Team email config completeness  *(do first; unblocks notif testing)*
- **Goal:** every org×team resolves a mailbox via `getTeamEmailConfig`; no hardcoded org emails elsewhere.
- **Current:** `getTeamEmailConfig(org, team)` + `teamEmails` exist in `mailer.js`. `ticketController.js`
  still has a hardcoded `IT_TEAM_EMAILS_BY_ORG` / `getItTeamEmails`.
- **Plan:** audit `teamEmails` for all 3 orgs × {IT/HELP_DESK, DBA, CRM, MIS} incl. **Autosense gaps**;
  delete `getItTeamEmails` and route those call-sites through `getTeamEmailConfig`.
- **Files:** `utils/mailer.js`, `controllers/ticketController.js`.
- **Verify:** grep shows no org email literals outside `mailer.js`; create ticket per org → correct mailbox.

### Task 2 — Notification recipient-builder  *(backbone)*
- **Goal:** one `buildRecipients(ticket, {actorId})` → the standard set (2.1), used by ALL events:
  raised, in-progress, resolved, closed, reopened, reassigned, + manual-approval parity.
- **Plan:** new `utils/recipients.js` `buildRecipients()` returning `{to, cc, transporterKey, from}`
  (raiser, assignee, assignee's team manager via `getTeamManagers`, org admins, team mailbox,
  `additional_email`). Refactor the status-change path in `ticketController.update` to emit exactly one
  email per event through it. Make manual approval call the SAME handler as the token approval path.
- **Files:** new `utils/recipients.js`; `controllers/ticketController.js`; `utils/mailer.js` (thin senders).
- **Verify:** each of the 6 events sends one email to the full set; manual vs auto approval identical.

### Task 4 — SLA-breach recipients  *(needs Task 2)*
- **Goal:** SLA emails use the same recipient set.
- **Plan:** in `utils/slaChecker.js`, replace ad-hoc recipients with `buildRecipients()`.
- **Files:** `utils/slaChecker.js`. **Verify:** force a breach → assignee+manager+admin+mailbox emailed.

### Task 6 — Per-ticket additional CC email  *(needs Task 2)*
- **Goal:** `additional_email` CCs receive all that ticket's notifications.
- **Current:** column + form field exist; validator allows comma-separated.
- **Plan:** ensure `buildRecipients()` appends `additional_email`; confirm form validation (multiple).
- **Files:** `utils/recipients.js` (already), minor frontend validation check. **Verify:** CC gets each event.

### Task 7 — Edit-ticket preload
- **Goal:** edit form shows all original values incl. org-conditional wing/desk.
- **Current:** team added dynamic wing/desk validators + `desk_number` persistence.
- **Plan:** confirm GET-by-id returns full `TICKET_SELECT` (has `desk_number`); ensure `patchValue` runs
  after async load with change detection; set conditional validators before patch.
- **Files:** `dashboard-list.component.ts` (editTicket path). **Verify:** edit a Hansa-Direct ticket → wing/desk prefilled.

### Task 1 — DBA dashboard visibility
- **Goal:** DBA tickets appear for the DBA manager/team like other teams (no separate stale path).
- **Current:** all roles load via `getAll()` → `ticketVisibilityScope`; manager-own fix shipped.
- **Plan:** verify DBA manager (team=DBA) sees DBA tickets; confirm no leftover team-specific frontend
  path (`getTicketsByAssignedTeam`) is used for DBA. Fix if a stale path exists.
- **Files:** `utils/access.js` (verify), frontend load path (verify). **Verify:** DBA manager sees DBA tickets instantly.

### Task 8 — Team Lead role (cross-org, single team)
- **Goal:** a Team Lead sees ALL tickets of their team across every org/location.
- **Plan:** add `TEAM_LEAD:'team_lead'` to `constants/roles.js`; `ticketVisibilityScope` clause
  `t.assigned_team_id = <team> OR t.created_by = <me>` (no org/location filter); include in login JWT;
  add role to the user-form Role selector; show an **Org** column for Team Leads on the dashboard.
- **Files:** `constants/roles.js`, `utils/access.js`, `controllers/userController.js` (JWT), user form + dashboard.
- **Verify:** IT Services Team Lead sees IT tickets from all 3 orgs, no other team's tickets.

### Task 9 — Re-approval email on pending edit
- **Goal:** editing a Pending-Approval ticket invalidates the old approval token and sends a fresh one.
- **Plan:** in `ticketController.update`, when the ticket is pending approval AND content changed,
  regenerate `approval_token` (new UUID), null the old, resend the approval email (note "edited,
  supersedes prior request"); old link → "superseded" page in `handleApproval`. Log invalidation.
- **Files:** `models/ticketModel.js` (regen token), `controllers/ticketController.js`, `utils/mailer.js`.
- **Verify:** edit pending ticket → exactly one new approval email; old link shows superseded page.

### Task 5 — Auto-assignment gaps  *(last; largest, external roster)*
- **Goal:** finish the shift-based auto-assign per 5.1–5.4.
- **Current:** `autoAssign.js`, `rosterClient.js`, `autoAssignRules.js` exist (Airoli IT + DBA).
- **Plan:** (a) add `roster_team_mapping` table + use it to resolve roster userName→user/team;
  (b) wing parse from description; exclude managers; lowest-open-count + round-robin tie-break;
  (c) transactional self-assign (row lock) to stop double-assign; (d) new ~5-min cron: shift-ending
  summary email (once per person) when shift ends within 30 min.
- **Files:** migration for `roster_team_mapping`; `utils/autoAssign.js`; new `utils/shiftEndCron.js`; `Server.js`.
- **Verify:** even distribution by open-count; one summary per person; managers excluded; no double-assign.

---

## Sequence
3 → 2 → 4 → 6 → 7 → 1 → 8 → 9 → 5. Each verified in Docker + committed separately.
