# Design: Shift-based Auto-Assignment for Airoli (Hansa Direct)

**Date:** 2026-06-23
**Status:** Approved-pending-review
**Scope:** Backend only. Single location: **Mumbai Airoli (`location_id=3`) / Hansa Direct
(`org_id=2`)**, IT Services team. No other location or org is affected.

## 1. Problem & goal

Today, after a ticket is **approved** it stays **unassigned** until a manager or the employee
manually assigns it (`POST /assign-ticket` or `/self-assign`). For the Airoli Hansa Direct IT
desk we want tickets to be **assigned automatically to whichever support person is currently on
shift**, using an external shift-roster service as the source of truth for "who is working now".

A background job polls the roster every minute and assigns/reassigns Airoli IT tickets to an
on-shift person. Every other location, org, and team keeps the existing manual flow untouched.

## 2. External roster API

`GET http://192.168.5.245:3001/api/sm/team/user-shifts?teamId=<rosterTeamId>&orgId=<rosterOrgId>`

For Airoli Hansa Direct IT the call is **`teamId=2&orgId=2`** (verified: `teamId=24` returns an
empty set; `teamId=2` returns the shift people). These IDs belong to the **shift system's own ID
space** — they are NOT this app's `team_id`/`org_id`, so they are configured as fixed constants.

Response shape (abridged):

```jsonc
{
  "success": true,
  "data": {
    "nilesh mishra": {                       // top-level key = person's display name
      "Tue Jun 23 2026": {                   // key = local (IST) calendar day
        "userId": 5447,                      // shift-system id (NOT our register_id)
        "userName": "nilesh mishra",
        "shiftStartTime": "10:00:00",        // local IST clock time
        "shiftEndTime": "19:00:00",
        "dayStatus": "FULL_DAY",             // FULL_DAY | HALF_DAY | WEEK_OFF
        "presentyStatus": "P"                // P = present
      }
      // ...one entry per day
    }
  }
}
```

### "On shift right now" test
A person is on shift when, for **today's IST date entry**:
- `dayStatus` is `FULL_DAY` or `HALF_DAY` (not `WEEK_OFF`), and
- `presentyStatus === 'P'`, and
- current IST time is within `[shiftStartTime, shiftEndTime)`.
  - Same-day shift (`start <= end`, e.g. 10:00–19:00): `start <= now < end`.
  - Overnight shift (`end < start`, e.g. 22:00–07:00): `now >= start || now < end`.

All date/time comparisons use timezone **`Asia/Kolkata`** (configurable) because the roster's
day-keys and clock times are local IST. We derive "today" and "now" via
`Intl.DateTimeFormat('en-US', { timeZone })` so server TZ is irrelevant.

## 3. Identity mapping (roster person → our user)

The roster payload has only `userId` (shift-system id) + `userName` — **no email**, and its
`userId` is a different id space (`5447` ≠ our `register_id 26`). So we map **by name**:

```
roster "nilesh mishra"
  → SELECT register_id, email_id FROM t_user
    WHERE LOWER(TRIM(first_name || ' ' || last_name)) = LOWER(TRIM(<rosterName>))
      AND org_id = 2                 -- Hansa Direct
    -- NOTE: we deliberately do NOT filter by team_id or location_id here.
```

**Why team/location are NOT checked:** the verified data shows nilesh mishra is the on-shift
roster person for Airoli IT, yet his `t_user` row is `team_id=2, location_id=2` — it does **not**
match the ticket's `team_id=24, location_id=3`. The shift roster, not `t_user.team_id`, is the
authoritative definition of "the Airoli IT shift team". We therefore trust the roster for *who*,
and use `t_user` only to resolve the roster name into a `register_id` for `assigned_to`. The
existing strict-membership check in `assignTicket` (`BAD_ASSIGNEE`) is **bypassed** on this path.

If a roster name matches 0 users (or >1) it is skipped and logged — it cannot be assigned safely.
(For one small team, multiple `org_id=2` users with the identical full name is not expected.)

## 4. Architecture

Mirror the existing `slaChecker.js` interval-job pattern. Three new backend files + small wiring.

```
roster service ──HTTP──> utils/rosterClient.js ──> utils/autoAssign.js ──> models/ticketModel.js ──> PostgreSQL
                                                          ▲
                                              Server.js setInterval (every 1 min)
```

### 4.1 `backend/config/autoAssignRules.js` (new)
A small array of rules so the feature is config-driven and extensible, but only Airoli IT is
enabled now:

```js
module.exports = [
  {
    label: 'Airoli Hansa Direct — IT Services',
    locationId: 3,        // our t_locations id (ticket.location_id)
    orgId: 2,             // our t_organization id (ticket.org_id)
    appTeamId: 24,        // our t_teams id (ticket.assigned_team_id) this rule covers
    rosterTeamId: 2,      // shift-system teamId to query
    rosterOrgId: 2,       // shift-system orgId to query
  },
];
```

### 4.2 `backend/utils/rosterClient.js` (new)
- `fetchOnShiftUsers(rule, now)` → `Promise<Array<{ rosterName, userId }>>`.
- Uses global `fetch` with an `AbortController` timeout (`ROSTER_TIMEOUT_MS`, default 8000).
- Builds the roster URL from `ROSTER_API_BASE` + `rule.rosterTeamId/rosterOrgId`.
- Computes the IST day-key (`"Tue Jun 23 2026"`) and current IST minutes, applies the
  on-shift test (§2), returns the on-shift people.
- Any failure (network/timeout/non-200/`success:false`) → returns `[]` and logs; never throws.

### 4.3 `backend/models/ticketModel.js` (additions)
- `getAutoAssignableTickets(rule)` → approved + **unassigned** tickets in scope:
  `location_id=rule.locationId AND org_id=rule.orgId AND assigned_team_id=rule.appTeamId
   AND assigned_to IS NULL AND status_name='Approved'`.
- `getReassignableTickets(rule)` → **assigned + In Progress** tickets in scope (for the
  off-shift reassignment rule), returning `assigned_to` too.
- `countOpenByAssignee(userIds)` → map of `register_id → count of In Progress tickets`
  (for least-loaded selection).
- `autoAssignTicket(ticketId, userId, remark)` → sets `assigned_to=userId`, `status_id` →
  *In Progress*, `updated_at=NOW()`, with a system `remark`. **No membership validation.**
  Returns the assignee's `email_id`/name for notification.

### 4.4 `backend/utils/autoAssign.js` (new)
`runAutoAssign()` — for each rule in `autoAssignRules`:
1. `onShift = fetchOnShiftUsers(rule, now)`; resolve each to `{ registerId, email, rosterName }`
   via the name match (§3). Drop unmatched (log). If `onShift` empty → **wait & notify**: leave
   tickets unassigned, skip rule (next tick retries). Optionally notify managers (reuse existing
   manager-notify helper) — but only once per ticket to avoid spam (guarded; see Open Items).
3. **New assignments:** for each `getAutoAssignableTickets(rule)`, pick the on-shift person with
   the **fewest open In Progress tickets** (`countOpenByAssignee`); tie-break by lowest
   `register_id`. Call `autoAssignTicket(...)` with remark `"Auto-assigned by shift roster"`.
   Notify the assignee (in-app + email, reusing `notification.js` / `mailer.js`).
4. **Reassignment (off-shift):** for each `getReassignableTickets(rule)`, **only if the current
   `assigned_to` is a roster-known person** (their name appears anywhere in the roster payload)
   **and** they are **not** in the current on-shift set → reassign to the least-loaded on-shift
   person (excluding the current assignee). Remark `"Reassigned: previous assignee off shift"`.
   Tickets assigned to non-roster users (e.g. manual assignments) are left untouched — this keeps
   the job from hijacking manual work and needs no schema change.

Selection ("prefer idle"): least-loaded = min open In Progress count, so a free on-shift person
is chosen over a busy one — matching the requested behavior.

### 4.5 `backend/Server.js` (wiring)
Add a second interval next to the SLA job:

```js
const { runAutoAssign } = require('./utils/autoAssign');
if (process.env.AUTO_ASSIGN_ENABLED !== 'false') {
  const ms = Number(process.env.AUTO_ASSIGN_INTERVAL_MS) || 60 * 1000;
  const job = async () => { try { await runAutoAssign(); } catch (e) { console.error('auto-assign failed:', e.message); } };
  setInterval(job, ms);
  job(); // run once at startup
}
```

## 5. Configuration (`.env`)
```
AUTO_ASSIGN_ENABLED=true
AUTO_ASSIGN_INTERVAL_MS=60000
ROSTER_API_BASE=http://192.168.5.245:3001
ROSTER_TIMEOUT_MS=8000
ROSTER_TIMEZONE=Asia/Kolkata
```
Scope IDs live in `config/autoAssignRules.js` (not `.env`) since they're a structured mapping.

## 6. Behavior summary (locked decisions)

| Concern | Behavior |
|---|---|
| Trigger | CRON poll every 1 min (env-configurable), like `slaChecker` |
| Scope | Airoli Hansa Direct IT only (`location 3 / org 2 / appTeam 24`) |
| Roster call | fixed `teamId=2 & orgId=2` |
| Identity | roster name → `t_user` by full name (org-scoped); team/location not enforced |
| On-shift | today IST, `presentyStatus='P'`, not WEEK_OFF, now within shift window; HALF_DAY counts |
| Selection | least-loaded on-shift person (prefers idle) |
| New tickets | Approved + unassigned → assign, status → In Progress |
| Reassign | In Progress ticket whose roster-known assignee is now off-shift → on-shift person |
| Nobody on shift | wait & notify; next tick assigns once someone is on shift |
| Validation | trust roster; bypass strict `BAD_ASSIGNEE` membership check |
| Failure | roster down/timeout/unmatched name → skip safely, log, never block |

## 7. Non-goals (YAGNI)
- No frontend changes (assignment shows up through existing ticket lists/badges).
- No new DB columns or migration.
- No auto-assign for DBA / Help Desk, other locations, or other orgs.
- No admin UI to edit rules (edit `autoAssignRules.js` + restart).
- No persistence of round-robin cursor (least-loaded is stateless).

## 8. Risks / open items
- **Name collisions / formatting:** match is `lower(trim(first||' '||last))`. If the roster
  formats names differently (extra spaces, middle name), the user is skipped + logged. Acceptable
  for one small team; revisit if logs show misses.
- **Roster outage:** job degrades to no-op (tickets wait); manual assignment still works.
- **Reassignment churn:** bounded — only fires when a roster person goes off-shift, moves the
  ticket once to an on-shift person, who keeps it until *they* go off-shift.
- **"Notify managers when nobody on shift" spam:** every-minute polling could re-notify. Mitigate
  by only notifying on the ticket's first eligible miss (e.g. reuse a notified flag) or skip the
  notify entirely and rely on existing approval-time manager notification. **Decision needed at
  review:** notify each tick? once? or not at all (rely on existing notify)?
- **Timezone:** assumes roster times are IST; handled via `ROSTER_TIMEZONE`.

## 9. Test plan (manual, no test runner exists)
- Roster reachable, person on shift, approved unassigned Airoli IT ticket → gets assigned to them,
  status In Progress, notification sent.
- Two on-shift people, one already has an In Progress ticket → new ticket goes to the free one.
- Nobody on shift → ticket stays Approved/unassigned; assigned on the tick after someone starts.
- Assignee goes off-shift mid-ticket → reassigned to an on-shift person next tick.
- Roster host unreachable → job logs error, no crash, tickets untouched.
- Non-Airoli / non-HansaDirect / DBA ticket → never auto-assigned.
- Roster name with no `t_user` match → skipped + logged.
```
