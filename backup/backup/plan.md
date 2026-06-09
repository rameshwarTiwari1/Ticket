# Fix & Feature Plan

Derived from `notes.txt` (the owner's requirements) + verification against the **live
database export** (the `All table/*.csv` dump) + a full read of the codebase. This plan
is the single source of truth for the remaining work. Nothing here is implemented yet.

---

## 0. What the real data proved (root causes)

Verified from `All table/` (t_teams, t_user, t_issues, t_tickets, t_locations):

| Fact | Value in live data |
|---|---|
| Locations | 1=Chennai, 2=Mumbai Kurla, 3=Mumbai Airoli |
| IT Services team | `team_id=2`, location **3 (Airoli)** |
| DBA team | `team_id=20`, location **3 (Airoli)** |
| Specialist teams (Admin, SSG, ESG, Campaigns, Data*, HR, Finance, Marketing) | all at location **2 (Kurla)** |
| OPS-Team-HD=15 (Airoli), OPS-Team-AS=16 (Chennai) | per office |
| **Akash Sonar (register_id 1)** | `role=manager`, `team_id=20 (DBA)`, location 3 → **he is the DBA manager** |
| IT Services manager | **none exists** — every `team_id=2` user is `role=employee` |
| **Issue→team mapping** (`t_issues.mapped_team_id`) | only ever **1 (Admin), 2 (IT Services), 3 (Campaigns)** — **NOTHING maps to DBA (20)** |
| "DBA" test tickets #136/#137 | used issues 11/8 which map to **team 2 (IT Services)** → routed to IT Services, not DBA |
| DB-type issues (Database/Backup/SFTP) | wrongly map to **team 1 (Admin)** |

**Root cause of "DBA ticket goes to IT Services / DBA manager can't see it" (notes #2,#6,#7):**
it is primarily a **data problem** — no issue maps to the DBA team, and DB issues map to
Admin/IT-Services. Routing follows `issue.mapped_team_id`, so DBA tickets can never reach
team 20 today. There is **also** a code gap (below) for cross-office routing and org scoping.

---

## PART A — Critical correctness fixes

### A1. Issue → team mapping (DATA, do first) — notes #1, #2, #6, #7
Without this, no code change makes DBA routing work.
- Map DBA categories to the DBA team (20); fix DB-type issues currently on Admin(1):
  ```sql
  UPDATE t_issues SET mapped_team_id = 20
  WHERE issue_name IN ('Database Issue','Backup Issue','SFTP Issue');   -- + any other DBA categories
  ```
- Audit the whole table so every issue maps to the intended team **for the right org/location**:
  ```sql
  SELECT i.issue_id,i.issue_name,i.mapped_team_id,t.team_name,t.location_id
  FROM t_issues i LEFT JOIN t_teams t ON t.team_id=i.mapped_team_id ORDER BY i.issue_name;
  ```
- Fix the 2 mis-routed test tickets (or delete): `UPDATE t_tickets SET assigned_team_id=20 WHERE ticket_id IN (136,137);`

### A2. Routing logic — `backend/models/ticketModel.js` → `resolveTeamForIssueAtLocation`
- **Finish the in-progress fix:** route strictly by the **issue's mapped team**; never fall back
  to the *creator's own team* (current uncommitted bug → mis-routes to IT Services).
- Make routing **org + location aware** (notes #1, #2): resolve the issue's mapped team to the
  instance at the **creator's org + location**. If none exists → return null (no silent
  cross-office assignment).

### A3. Replace the 500 with professional validation — notes #4
- `models/ticketModel.js` currently `throw new Error('No team is set up …')` → controller returns **500**.
- Change `controllers/ticketController.js` `create` to detect the no-team / mapping case and return
  **HTTP 400** with `{ code: 'NO_TEAM_MAPPING', message }` (and validate org/location/category up front).
- Frontend shows it as a toast/modal (see A5), not a 500.

### A4. Manager visibility — org + team + location — notes #3, #6, #7
- `backend/utils/access.js` → `ticketVisibilityScope` (manager branch) and
  `canViewTicket/canAssignTicket/canWorkTicket`: currently scope by **location + team**. Add
  **org_id** so a manager sees only their **org + location + team** tickets.
- This makes the DBA manager see DBA tickets (once A1 routes them to team 20) and prevents the
  IT-Services manager from seeing DBA tickets (they're a different team_id).
- Confirm the frontend manager branch (`loadTickets` → `getTicketsByLocation`) still relies on the
  server scope (it does after the earlier passthrough change).

### A5. Professional error/validation UI — notes #4, #5, Phase-1 #4
- Add a lightweight **toast + modal** service/component (Angular) and replace all `alert(...)`
  and `errorMessage` browser alerts in: `dashboard-list.component.ts`, `login`, `registration`,
  `forgot-password`, `approver-management`.
- Standard messages: invalid category, team mapping not found, required fields missing,
  unauthorized, invalid org/location mapping.

---

## PART B — Phase 1 features (notes "first implementation")

| # | Feature | Where |
|---|---|---|
| B1 | **Manager can re-assign** an already-assigned ticket | backend `assignTicket` (allow changing `assigned_to` when already set); frontend: show "Reassign" when `assigned_to_id` present (currently the button is disabled once assigned) |
| B2 | **Employee self-assign** (employee only) | backend: new path allowing an employee to set `assigned_to = self` on an unassigned ticket of their team+location; frontend: "Assign to me" button for employees |
| B3 | **SLA email alert when not closed in a date range** → manager + employee + admin | extend `utils/slaChecker.js` (already notifies assignee+manager) to also notify **admin(s)**; tie to the SLA/overdue window |
| B4 | Professional popup alerts | = A5 |
| B5 | **Remove Attachments** (for now) | hide the attachment field in the new-ticket form (`dashboard-list.component.html`) and stop sending it; keep backend column for later |

---

## PART C — Phase 2 features (notes "second implementation")

| # | Feature | Where |
|---|---|---|
| C1 | **Date dropdown**: yearly, half-yearly, current month, last month (+ existing) | `dashboard-list.component.ts` `setDateRange` + the dropdown HTML; reuse the local-date helper |
| C2 | **Activity logs** | new table `t_activity_log` (user_id, activity_type, description, old_value, new_value, ip_address, created_at); log on login/logout, ticket lifecycle changes, role changes; admin/manager view screen |
| C3 | **`t_user.created_at` / `updated_at`** | migration + stamp on create/update |
| C4 | **Ticket rating + experience** (visible to manager & admin only) | new columns/table (`rating`, `experience` on ticket or `t_ticket_feedback`); requester submits after Resolved/Closed; gated view |
| C5 | **`t_teams.updated_at`** for team-edit tracking | migration + stamp on team update |
| C6 | **Approvers inline (no separate URL)** — notes Phase2 #7 | move the `/approvers` screen into a **dashboard tab/modal** (admin) instead of the standalone route; keep the same `ApproverService`/endpoints |

---

## Migrations needed (new `002_*.sql`)
- `t_user`: `created_at`, `updated_at` (C3)
- `t_teams`: `updated_at` (C5)
- `t_activity_log` table (C2)
- ticket rating columns / `t_ticket_feedback` (C4)

---

## Suggested execution order
1. **A1 (data)** + **A2/A3/A4 (routing, 500→400, org-scoped visibility)** — fixes the reported DBA/IT bugs. *(highest priority)*
2. **A5 / B4** professional toasts/modals (also unblocks the 400 UX).
3. **B1, B2, B5** (reassign, self-assign, hide attachments).
4. **B3** SLA-to-admin.
5. **C6** approvers inline, **C1** date filters.
6. **C2–C5** logs, audit columns, ratings.

## Verification (after Part A)
- As an **Airoli user**, raise a ticket on a **DBA-mapped** issue → `assigned_team_id=20`, `org/location` correct.
  - **Akash (DBA manager)** sees it; an **IT Services** manager does **not**.
- Raise a ticket whose issue maps to a team **not present at the user's org/location** → **400 toast**
  ("Team mapping not found"), **no 500**, no ticket created.
- Confirm employees still see only assigned tickets; users only their own; admin all.

## Open items to confirm with owner
- **Org vs location precedence**: notes want org **and** location **and** team scoping — confirm a
  manager is always tied to exactly one (org, location, team). (Data currently supports this.)
- **DB issues currently mapped to Admin(1)** — confirm which issue names are DBA vs IT vs Admin.
- Ratings storage shape (columns on ticket vs separate feedback table).

> Note: there is currently **one uncommitted change** in `models/ticketModel.js`
> (`resolveTeamForIssueAtLocation`) that A2 will finalize.


npm run migrate          # applies 001 → 002 → 003 (schema + safe data fixes)
npm run migrate:status   # verify
# then in pgAdmin: the MANUAL SEED steps (admin role, approvers, user locations)
npm run migrate:passwords   # optional, hashes any leftover plaintext passwords
# restart backend