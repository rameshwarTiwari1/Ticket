# Ticket Management System — Requirements Specification

A multi-tenant, **location-based** IT ticket management system for the Hansa group
(organizations: **Hansa Direct**, **Hansa Cequity**, **Autosense**). Users raise support
tickets; teams (IT Service, DBA, Help Desk) approve, assign, and resolve them. Who can see and
act on a ticket is governed by **role**, **organization**, and the **location the ticket was
created in**.

> **Status of this document.** This is the agreed product specification. Items marked
> **[CONFIRMED]** were decided with the product owner. Items marked **[DESIGN — confirm]** are
> recommended designs chosen on the owner's behalf and should be reviewed.
> See `PROJECT_STATUS.md` for how much of this is currently built.

---

## 1. Core concepts

The system is a hierarchy. Every ticket flows through it:

```
Organization  →  Location  →  Team / Wing  →  User
 (Hansa Direct)   (e.g. Mumbai)  (IT Service,     (employees,
 (Hansa Cequity)  (e.g. Pune)     DBA, Help Desk)   requesters)
 (Autosense)
```

| Term | Meaning |
|------|---------|
| **Organization** | A company tenant. Data is segregated per organization. |
| **Location** | A physical site within the org. **Drives ticket visibility.** |
| **Team** | A functional group *at a location* (e.g. "IT Service @ Mumbai"). The same team name can exist at many locations — they are **distinct** teams. |
| **Wing** | A sub-division of a location (department/floor/unit). |
| **User** | A person. Has exactly one current location, one team (optional), one organization. |
| **Ticket** | A support request. Permanently stamped with `org_id`, `location_id`, and an `assigned_team`. |

### Roles
There are four roles. **Role is separate from team membership.**

- **Admin** — full control across all orgs and locations.
- **Manager** — an employee whom an **Admin has promoted** to manage a specific team
  (e.g. "Manager of IT Service @ Mumbai"). A Manager is still a member of that team.
- **Employee** — a member of a team who works tickets assigned to them.
- **User (Requester)** — anyone who raises tickets.

---

## 2. The Golden Rule — location-based visibility  **[CONFIRMED]**

> A ticket's visibility is always determined by **(creation location) + (assigned team) +
> (user role)**.

- A ticket created at **Location A** is visible only within Location A's scope. It must **never**
  appear under **Location B**, *even if the same team (e.g. IT Service) exists at Location B*.
- A ticket's `location_id` is **immutable** — set once at creation, never changed.
- This rule must be enforced on the **server** (in the database queries), not only in the UI.

---

## 3. Roles & permissions  **[CONFIRMED]**

| Capability | User (Requester) | Employee | Manager | Admin |
|---|:---:|:---:|:---:|:---:|
| Create a ticket | ✅ | ✅ | ✅ | ✅ |
| View **own** tickets (raised by them) | ✅ | ✅ | ✅ | ✅ |
| View tickets **assigned to them** | — | ✅ | ✅ | ✅ |
| View **all tickets in their team + location** | ❌ | ❌ | ✅ | ✅ |
| View tickets in **other locations** | ❌ | ❌ | ❌ | ✅ |
| Add comments / work notes | own only | ✅ (assigned) | ✅ (team) | ✅ |
| Update ticket **status** | ❌ | ✅ (assigned) | ✅ (team) | ✅ |
| Edit ticket details | ❌ | ❌ | ✅ (team) | ✅ |
| **Assign / reassign** tickets | ❌ | ❌ | ✅ (to employees in own team + location) | ✅ |
| **Switch organization** (view across orgs) | ❌ | ❌ | ✅ (view-only) | ✅ |
| Approve tickets | ❌ | ❌ | ❌ (unless they are the designated approver) | ✅ |
| Manage users, teams, locations | ❌ | ❌ | ❌ | ✅ |
| **Promote an employee to Manager** | ❌ | ❌ | ❌ | ✅ |

Notes:
- **Admin** can switch organizations via a dropdown; on switching, they see all tickets for all
  locations of that org.
- **Manager** can also switch organizations, but only to **view** — they cannot act on tickets
  outside their own team + location.
- **Employee** can never reassign a ticket or see another location's tickets.
- **Manager is granted by an Admin**, on top of an existing team membership. Being a member of IT
  Service or DBA does **not** by itself make someone a Manager.

---

## 4. Ticket lifecycle  **[CONFIRMED]**

Every ticket moves through explicit states. Transitions are restricted by role.

```
        ┌─────────────────────────── reject ───────────────────────────┐
        ▼                                                               │
 [NEW] ──submit──► [PENDING APPROVAL] ──approve──► [APPROVED] ──assign──► [IN PROGRESS]
                          │                                                │   │
                          └── not approved ──► [REJECTED] (closed)         │   ├─► [ON HOLD] ──resume──┐
                                                                           │   │                       │
                                                                           │   ◄───────────────────────┘
                                                                           ▼
                                                            [RESOLVED] ──confirm/auto──► [CLOSED]
                                                                 ▲                          │
                                                                 └──── reopen ◄─────────────┘
```

| State | Meaning | Who can move it here |
|-------|---------|----------------------|
| **New** | Just created by a requester. | Requester (on submit) |
| **Pending Approval** | Awaiting the designated approver. | System (automatic on create) |
| **Approved** | Approver said yes; ready to be assigned. | Approver |
| **Rejected** | Approver said no. Ticket is closed, requester notified. | Approver |
| **In Progress** | Assigned to an employee and being worked. | Manager (assigns) / Employee (starts) |
| **On Hold** | Waiting on requester or a third party. | Employee / Manager |
| **Resolved** | Fix applied; awaiting requester confirmation. | Employee / Manager |
| **Closed** | Confirmed done. | Requester confirms, **or** auto-close after N days of no response **[DESIGN — confirm: N = 3 days]** |
| **Reopened** | Requester says the fix didn't work; returns to In Progress. | Requester (within a window) |

A ticket **cannot be assigned until it is Approved** (see §6).

---

## 5. Creating a ticket & location stamping  **[CONFIRMED]**

1. A requester creates a ticket, selecting an **Issue/Category**, **Priority**, subject,
   description, and optional attachment.
2. The system stamps the ticket with:
   - `org_id` — the requester's organization,
   - **`location_id` — the requester's *current* location at the moment of creation**,
   - `assigned_team` — derived by routing (see §7).
3. `location_id` is then **frozen for the life of the ticket**.

> **Location is a property of the USER, not the organization.** Each user has their own current
> location. (This differs from the original build, which derived location from the organization.)

---

## 6. Approval workflow  **[CONFIRMED]**

**All tickets require approval before any work begins.**

Flow:
1. On creation, the ticket becomes **Pending Approval** and an approval email is sent to the
   **designated approver** for that ticket (see below).
2. The email contains a secure, **single-use** approve / reject link.
3. The approver clicks **Approve** or **Not Approved**:
   - **Approved** → ticket becomes *Approved*; the relevant **Manager** is notified to assign it.
   - **Not Approved** → ticket becomes *Rejected*; the requester is notified. (An optional remark
     explains why.)
4. The approval link is invalidated after use (cannot be reused).
5. Only after approval can a **Manager assign** the ticket to an **Employee** (§7).

### Who is the approver, and how is one chosen?  **[CONFIRMED]**

**Admin-managed approver registry.** Admin maintains a dynamic list of approvers (a CRUD screen).
Each approver entry is a real, validated user/email **mapped to a Location + Team** (and optionally
an Issue/Category) — e.g. the approver for "IT Service @ Mumbai". If no team-level approver is
configured for a location, the system falls back to a **location-level default approver**.

**Filtered dropdown on the ticket form, with auto-select fallback.** When creating a ticket, the
creator sees a **"Send approval to"** dropdown that lists only the approvers configured for **their
location** (chosen from the admin registry). They may pick one, or leave it on **"Auto-select"** —
in which case the system resolves the correct approver from the registry by the ticket's
**location + routed team** (with the location default as fallback).

Rationale:
- The admin-managed registry replaces the original build's brittle behavior (it emailed whatever
  address was typed into the ticket form) — no typos, no invalid/unauthorized approvers.
- The dropdown is **location-filtered**, so a requester can only pick a valid local approver
  (a picked email is re-validated server-side against the registry for that location).
- If left on Auto-select, the approver is still kept **local** to where the ticket was raised
  (upholds the Golden Rule, §2).
- Approval stays **separate from assignment**: the approver decides *whether*, the Manager decides
  *who*.

> Data needed from Admin: the approver(s) for each Location + Team, and a default approver per
> location, entered on the **Approver Registry** admin page (`/approvers`).

---

## 7. Routing & assignment  **[CONFIRMED]**

Two stages: **auto-route to a team, then a human assigns the person.**

1. **Auto-route (system).** Based on the selected **Issue/Category**, the system maps the ticket to
   the responsible team — scoped to the **ticket's location**. (Each issue category maps to a team
   type; combined with the ticket's location this resolves to a specific team, e.g. "DBA @ Pune".)
2. **Manual assign (Manager).** After approval, the Manager of that team+location assigns the
   ticket to a specific **Employee** within their team + location.

Constraints:
- A Manager can only assign to employees **in their own team and location**.
- A ticket can never be routed or assigned to a team at a **different** location, even if a team
  with the same name exists there (the Golden Rule, §2).

---

## 8. Location-change / transfer scenario  **[CONFIRMED]**

When a user is transferred from **Location A** to **Location B**:
- The user's **current location** is updated to B.
- **Tickets they created while at Location A remain stamped with Location A** and stay under
  Location A's listings. They do **not** move to Location B.
- **New tickets** the user creates after the transfer are stamped with Location B and follow
  Location B's routing rules.

> This requires the system to track each user's **current location** (and ideally a history of
> location changes), independent of the organization.

---

## 9. SLA & priority  **[CONFIRMED]**

Each ticket has a **priority** that sets an SLA due time from creation:

| Priority | SLA target (from creation) |
|----------|----------------------------|
| High | 4 hours |
| Medium | 8 hours |
| Low | 1 day |

On **SLA breach** (current time passes the due time while the ticket is not Resolved/Closed):
- the ticket is **visually flagged** as breached/overdue, **and**
- a **notification/email** is sent to the assigned employee **and** their Manager.

> **[DESIGN — confirm]** Who sets priority — the requester, or the triaging Manager? Recommended:
> requester proposes a priority; Manager may adjust it during triage. SLA timer is based on the
> priority at creation.

---

## 10. Notifications  **[DESIGN — confirm recipients]**

Email / in-app notifications should be sent on these events:

| Event | Recipients |
|-------|-----------|
| Ticket created | Requester (confirmation) + designated approver (approval request) |
| Ticket approved | Manager of the routed team+location (to assign) + requester |
| Ticket rejected | Requester (with remark) |
| Ticket assigned | Assigned employee + requester |
| Comment / work note added | Requester + assigned employee (whoever didn't write it) |
| Status changed to Resolved | Requester (to confirm) |
| Ticket closed / reopened | Requester + assigned employee |
| **SLA breached** | Assigned employee + their Manager |

Email is sent from the correct **per-organization** mailbox (Hansa Cequity vs Hansa
Direct/Autosense).

---

## 11. Categorization fields

A ticket carries these descriptive fields (used for routing, filtering, and reporting):

- **Type** — e.g. Incident vs Service Request.
- **Issue / Category** — the specific problem area; **maps to a responsible team** (drives routing, §7).
- **Priority** — High / Medium / Low (drives SLA, §9).
- **Client** — the client/account the ticket relates to (if applicable).
- **Wing** — the sub-division of the location.
- **Attachment** — optional file (image / PDF / Office doc), size-limited.

---

## 12. Multi-organization behavior  **[CONFIRMED]**

- Data is **segregated by organization**. A normal user only ever works within their own org.
- **Admin** and **Manager** can switch the active organization via a dropdown:
  - Admin: full access to the selected org's tickets across all its locations.
  - Manager: **view-only** across orgs; can still only *act* within their own team + location.

---

## 13. Open decisions to confirm

These are recommended defaults written above; please confirm or correct:

1. **Approver registry data (§6)** — model is confirmed (admin-managed, auto-selected by
   Location+Team). Still need the **actual approver(s)** for each Location+Team and the default
   approver per location.
2. **Auto-close window (§4)** — Resolved tickets auto-close after **3 days** of no requester response.
3. **Reopen window (§4)** — how long after Closed can a requester reopen? (Recommended: 7 days.)
4. **Who sets/changes priority (§9)** — requester proposes, Manager may adjust.
5. **Notification recipients (§10)** — confirm the table.
6. **Help Desk team** — the rules mention IT Service, DBA, and Help Desk. Confirm Help Desk is a
   real team type and how issues route to it.

### Operational notes / edge cases surfaced during implementation

These are behaviors of the current build that you should be aware of (decide if they need changing):

a. **Manager visibility = team + location, not the whole location.** The original rule 2 said a
   Manager sees "their assigned location"; this build interprets that as *their team at their
   location* (e.g. the IT Service manager sees IT Service tickets at their location, not DBA's).
   If a Manager should instead see **all teams** at their location, this needs to change in
   `utils/access.js`.

b. **A self-registered user has no location until an Admin assigns one** (registration leaves
   location blank by design). Because a ticket's location comes from its creator, **such a user
   cannot raise a ticket until the Admin sets their location/team.** Onboarding must include that step.

c. **If no approver is configured for a ticket's location+team, no approval email is sent** and the
   ticket stays *Pending Approval* until an Admin adds an approver (it then needs re-triggering).
   Seed the approver registry before going live (§6).

d. **Manager org-switch is view-scoped to their own location/team.** When a Manager switches org,
   this build still only returns their own team+location tickets — it does not widen to all
   locations of the other org. Confirm whether Managers should get a broader read across orgs.

---

## Appendix — relationship to the original rules

The original README listed seven rules (Admin / Manager / Employee / User access, location-based
routing, location-change scenario, visibility rule). They are all preserved and expanded above:
rule 1 → §3, rule 2 → §3, rule 3 → §3, rule 4 → §3, rule 5 → §7 + §2, rule 6 → §8, rule 7 → §2.
The original text remains available in git history.
