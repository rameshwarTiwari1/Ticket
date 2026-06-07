-- =============================================================================
-- Migration 001 — Ticketing rules & architecture
-- Apply against the Ticketing_Tool_Hansa database:
--   psql "host=192.168.5.39 port=5432 dbname=Ticketing_Tool_Hansa user=hansa_user" -f 001_ticketing_rules.sql
-- Idempotent: safe to run more than once.
-- PostgreSQL folds unquoted identifiers to lowercase, matching the app's queries.
-- =============================================================================

BEGIN;

-- ─── 1. User role (Admin / Manager / Employee / User) ────────────────────────
-- Role is SEPARATE from team membership. Admin promotes an employee to 'manager'
-- of their existing team. Default 'user' (requester).
ALTER TABLE t_user
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Backfill sensible roles from existing team membership (one-time best-effort):
--  - anyone in the 'admin' team   -> admin
--  - anyone in it services / dba  -> employee (Admin can later promote to manager)
UPDATE t_user u
SET role = 'admin'
FROM t_teams t
WHERE u.team_id = t.team_id
  AND LOWER(TRIM(t.team_name)) = 'admin'
  AND u.role = 'user';

UPDATE t_user u
SET role = 'employee'
FROM t_teams t
WHERE u.team_id = t.team_id
  AND LOWER(TRIM(t.team_name)) IN ('it services', 'it service', 'dba', 'help desk')
  AND u.role = 'user';

-- ─── 2. User location-change history (transfer scenario) ─────────────────────
-- A ticket's location is stamped from the creator's CURRENT location at creation
-- and never changes. When a user is transferred we record the change here so old
-- tickets stay with the old location and new ones use the new one.
CREATE TABLE IF NOT EXISTS t_user_location_history (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES t_user(register_id) ON DELETE CASCADE,
  old_location_id  INTEGER REFERENCES t_locations(location_id),
  new_location_id  INTEGER REFERENCES t_locations(location_id),
  changed_by       INTEGER REFERENCES t_user(register_id),
  changed_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_loc_hist_user ON t_user_location_history(user_id);

-- ─── 3. Approver registry (admin-managed, auto-selected by location+team) ─────
-- The approver for a ticket is resolved from this table by (org, location, team),
-- falling back to a location-level default (team_id IS NULL AND is_default).
CREATE TABLE IF NOT EXISTS t_approvers (
  approver_id    SERIAL PRIMARY KEY,
  org_id         INTEGER REFERENCES t_organization(org_id),
  location_id    INTEGER NOT NULL REFERENCES t_locations(location_id),
  team_id        INTEGER REFERENCES t_teams(team_id),          -- NULL = location-wide
  approver_email VARCHAR(255) NOT NULL,
  approver_name  VARCHAR(255),
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,               -- location-level fallback
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- One approver mapping per (location, team) combination; NULL team handled separately.
CREATE UNIQUE INDEX IF NOT EXISTS uq_approver_loc_team
  ON t_approvers(location_id, team_id) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_approver_loc_default
  ON t_approvers(location_id) WHERE team_id IS NULL;

-- ─── 4. Ticket SLA breach flag ───────────────────────────────────────────────
ALTER TABLE t_tickets
  ADD COLUMN IF NOT EXISTS sla_breached       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sla_breach_notified BOOLEAN NOT NULL DEFAULT FALSE;

-- Columns referenced by assignTicket() that may not exist yet:
ALTER TABLE t_tickets
  ADD COLUMN IF NOT EXISTS estimated_end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS remark             TEXT;

-- Resolved approver (auto-selected from the approver registry at creation).
-- The approval email is sent here instead of a requester-typed address.
ALTER TABLE t_tickets
  ADD COLUMN IF NOT EXISTS approver_email VARCHAR(255);

-- ─── 4b. In-app notifications (referenced by utils/notification.js) ──────────
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES t_user(register_id) ON DELETE CASCADE,
  ticket_id   INTEGER REFERENCES t_tickets(ticket_id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ─── 4c. Ticket comments / work notes (used by models/commentModel.js) ───────
CREATE TABLE IF NOT EXISTS ticket_comments (
  comment_id   SERIAL PRIMARY KEY,
  ticket_id    INTEGER NOT NULL REFERENCES t_tickets(ticket_id) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES t_user(register_id),
  user_name    VARCHAR(255),
  team_name    VARCHAR(255),
  comment_text TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- ─── 5. Seed the canonical ticket statuses (lifecycle) ───────────────────────
INSERT INTO ticket_status (status_name)
SELECT v.name
FROM (VALUES
  ('Pending Approval'), ('Approved'), ('Rejected'),
  ('Open'), ('In Progress'), ('On Hold'),
  ('Resolved'), ('Closed'), ('Reopened')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM ticket_status s
  WHERE LOWER(TRIM(s.status_name)) = LOWER(TRIM(v.name))
);

COMMIT;

-- =============================================================================
-- IMPORTANT — existing plaintext passwords
-- Login now uses bcrypt.compare(). Passwords created via the admin "addUser" path
-- were already bcrypt-hashed; passwords created via /api/auth/register were stored
-- as PLAINTEXT and will fail to log in after this change.
-- Run scripts/migrate_passwords.js ONCE to hash any remaining plaintext passwords.
-- =============================================================================
