BACKEND API REFERENCE
=====================
Run:   npm start          (Server.js → http://localhost:3008, PORT from .env)
Base:  http://localhost:3008/api
Auth:  send "Authorization: Bearer <JWT>" on all routes except those marked PUBLIC.
       The JWT carries { userId, role, org_id, team_id, location_id }.
Roles: admin | manager | employee | user  (see ../README.md for the rules).

NOTE: ticket visibility is enforced SERVER-SIDE by role + location (the Golden Rule).
      Every list/read endpoint returns only what the caller is allowed to see.

AUTH  (/api/auth)
  POST /send-otp                 PUBLIC  { email }
  POST /verify-otp              PUBLIC  { email, otp }
  POST /register               PUBLIC  { first_name,last_name,email_id,password,employee_id,team_name,org_name,otp }
  POST /reset-password         PUBLIC  { email, otp, newPassword }

USERS  (/api/users)
  POST /login                  PUBLIC  { email, password } -> { token, user }
  GET  /emails                 any auth
  GET  /assignable             manager/admin   employees in own team+location (admin: ?team_id&location_id)
  GET  /:id                    any auth
  GET  /                       manager/admin
  POST /                       admin           create user
  PUT  /:id                    admin           update user
  DELETE /:id                  admin
  PUT  /:id/role               admin           { role }                 promote to manager etc.
  PUT  /:id/transfer           admin           { location_id }          change location (records history)
  POST /reassign               manager/admin   { oldUserId, newUserId }
  POST /delete-with-reassign/:id  admin        { newUserId }

TICKETS  (/api/tickets-generate)
  GET  /approve/:token?action=approved|not_approved   PUBLIC (email link, single-use)
  GET  /sla/check              admin           run SLA breach scan now
  POST /assign-ticket          manager/admin   { ticket_id, assigned_to, org_name?, estimated_end_date?, remark? }
  GET  /user/:userId           self or admin
  GET  /location/:locationId   own location or admin
  POST /                       any auth (multipart) create ticket -> Pending Approval, auto-routed, approver auto-selected
  GET  /                       any auth         scoped list (admin may ?org_id=)
  GET  /:id                    any auth (must be allowed to view)
  PUT  /:id                    role-dependent   status change = work perm + valid transition; field edits = edit perm
  DELETE /:id                  manager/admin
  GET  /:id/comments           any auth
  POST /:id/comments           admin / manager / assigned employee / owner   { comment_text }

APPROVERS  (/api/approvers)   admin-managed registry; approver auto-selected at ticket creation
  GET  /                       manager/admin   (?org_id&location_id)
  POST /                       admin           { location_id, approver_email, team_id?, org_id?, is_default?, approver_name? }
  PUT  /:id                    admin
  DELETE /:id                  admin

NOTIFICATIONS  (/api/notifications)
  GET  /                       any auth   (?unread=true)
  PUT  /:id/read               any auth
  PUT  /read-all               any auth

OTHER CRUD (admin writes; reads vary): /api/teams, /api/organizations, /api/locations,
  /api/wings, /api/issues (issue.mapped_team_id drives auto-routing), /api/clients,
  /api/types, /api/ticket-status.

DEPLOYMENT (first time / after pulling these changes):
  1) Apply migrations/001_ticketing_rules.sql to the database.
  2) node scripts/migrate_passwords.js   (hash any leftover plaintext passwords)
  3) Set admin role(s), ensure users have location_id, promote managers.
  4) Seed approvers via /api/approvers (one per location+team + a location default).
See ../PROJECT_STATUS.md for the full implementation notes.
