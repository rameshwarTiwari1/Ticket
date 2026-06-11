-- =============================================================================
-- 000_base_schema.sql  —  FULL base schema for Ticketing_Tool_Hansa
--
-- Reconstructed from the model SQL (backend/models/*) and the live DB column
-- dumps. This is the "fresh start" schema: it creates EVERY table and column the
-- application expects, INCLUDING the columns/tables that migrations 001 & 002
-- normally add. Because both migrations are fully idempotent (ADD COLUMN /
-- CREATE TABLE / CREATE INDEX ... IF NOT EXISTS), running `npm run migrate` after
-- this file is a harmless no-op that simply records 001–003 as applied and runs
-- the 003 data fixes.
--
-- Loaded automatically by the Postgres container on FIRST init
-- (mounted into /docker-entrypoint-initdb.d). PostgreSQL folds unquoted
-- identifiers to lowercase, matching every query in the app.
-- =============================================================================

BEGIN;

-- ─── Reference / lookup tables (no FK dependencies first) ────────────────────
CREATE TABLE IF NOT EXISTS t_locations (
  location_id   SERIAL PRIMARY KEY,
  location_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS t_organization (
  org_id      SERIAL PRIMARY KEY,
  org_name    VARCHAR(255) NOT NULL,
  location_id INTEGER REFERENCES t_locations(location_id)
);

CREATE TABLE IF NOT EXISTS t_teams (
  team_id     SERIAL PRIMARY KEY,
  team_name   VARCHAR(255) NOT NULL,
  location_id INTEGER REFERENCES t_locations(location_id),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP   -- (added by migration 002)
);

CREATE TABLE IF NOT EXISTS t_wings (
  wing_id     SERIAL PRIMARY KEY,
  wing_name   VARCHAR(255) NOT NULL,
  location_id INTEGER REFERENCES t_locations(location_id)
);

CREATE TABLE IF NOT EXISTS t_types (
  type_id   SERIAL PRIMARY KEY,
  type_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS t_issues (
  issue_id       SERIAL PRIMARY KEY,
  issue_name     VARCHAR(255) NOT NULL,
  type_id        INTEGER REFERENCES t_types(type_id),
  mapped_team_id INTEGER REFERENCES t_teams(team_id)   -- which team handles this issue
);

CREATE TABLE IF NOT EXISTS t_clients (
  client_id    SERIAL PRIMARY KEY,
  client_name  VARCHAR(255) NOT NULL,
  organization INTEGER,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_status (
  status_id   SERIAL PRIMARY KEY,
  status_name VARCHAR(50) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS t_user (
  register_id   SERIAL PRIMARY KEY,
  employee_id   VARCHAR(50),
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  mobile_number VARCHAR(20),
  team_id       INTEGER REFERENCES t_teams(team_id),
  location_id   INTEGER REFERENCES t_locations(location_id),
  wing_id       INTEGER REFERENCES t_wings(wing_id),
  email_id      VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  org_id        INTEGER REFERENCES t_organization(org_id),
  role          VARCHAR(20) NOT NULL DEFAULT 'user',          -- (added by migration 001)
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- (added by migration 002)
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP  -- (added by migration 002)
);

-- ─── Tickets (the core entity) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS t_tickets (
  ticket_id           SERIAL PRIMARY KEY,
  ticket_number       VARCHAR(50) UNIQUE,
  created_by          INTEGER REFERENCES t_user(register_id),
  assigned_to         INTEGER REFERENCES t_user(register_id),
  assigned_to_user    VARCHAR(255),
  subject             VARCHAR(255),
  description         TEXT,
  type_id             INTEGER REFERENCES t_types(type_id),
  issue_id            INTEGER REFERENCES t_issues(issue_id),
  assigned_team_id    INTEGER REFERENCES t_teams(team_id),
  status_id           INTEGER REFERENCES ticket_status(status_id),
  priority            VARCHAR(20),
  email_id            VARCHAR(255),
  additional_email    VARCHAR(255),
  attachment          VARCHAR(255),
  remark              TEXT,                                   -- (added by migration 001)
  estimated_end_date  TIMESTAMP,                              -- (added by migration 001)
  resolved_at         TIMESTAMP,
  closed_at           TIMESTAMP,
  sla_due_at          TIMESTAMP,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  client_id           INTEGER,
  location_id         INTEGER REFERENCES t_locations(location_id),
  org_id              INTEGER REFERENCES t_organization(org_id),
  wing_id             INTEGER REFERENCES t_wings(wing_id),
  desk_number         VARCHAR(50),
  assigned_to_team    VARCHAR(255),
  approval_status     VARCHAR(20) DEFAULT 'pending',
  approval_token      VARCHAR(255),
  approved_by         VARCHAR(255),
  approved_at         TIMESTAMP,
  approval_remark     TEXT,
  sla_breached        BOOLEAN NOT NULL DEFAULT FALSE,         -- (added by migration 001)
  sla_breach_notified BOOLEAN NOT NULL DEFAULT FALSE,         -- (added by migration 001)
  approver_email      VARCHAR(255),                           -- (added by migration 001)
  rating              SMALLINT,                               -- (added by migration 002)
  experience          TEXT,                                   -- (added by migration 002)
  rated_at            TIMESTAMP,                              -- (added by migration 002)
  created_by_location INTEGER,
  created_by_org      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tickets_location ON t_tickets(location_id);
CREATE INDEX IF NOT EXISTS idx_tickets_team     ON t_tickets(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON t_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON t_tickets(assigned_to);

-- ─── Email OTP (registration / password reset) ───────────────────────────────
CREATE TABLE IF NOT EXISTS t_email_otp (
  id         SERIAL PRIMARY KEY,
  email_id   VARCHAR(255) NOT NULL,
  otp        VARCHAR(10)  NOT NULL,
  expires_at TIMESTAMP    NOT NULL
);

-- =============================================================================
-- Tables also created by migrations 001 / 002 (defined here so a fresh DB is
-- complete before the migration runner runs). The runner's CREATE ... IF NOT
-- EXISTS will simply skip them.
-- =============================================================================

-- (migration 001) user location-change history
CREATE TABLE IF NOT EXISTS t_user_location_history (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES t_user(register_id) ON DELETE CASCADE,
  old_location_id INTEGER REFERENCES t_locations(location_id),
  new_location_id INTEGER REFERENCES t_locations(location_id),
  changed_by      INTEGER REFERENCES t_user(register_id),
  changed_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_loc_hist_user ON t_user_location_history(user_id);

-- (migration 001) approver registry — resolved by (org, location, team)
CREATE TABLE IF NOT EXISTS t_approvers (
  approver_id    SERIAL PRIMARY KEY,
  org_id         INTEGER REFERENCES t_organization(org_id),
  location_id    INTEGER NOT NULL REFERENCES t_locations(location_id),
  team_id        INTEGER REFERENCES t_teams(team_id),
  approver_email VARCHAR(255) NOT NULL,
  approver_name  VARCHAR(255),
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_approver_loc_team
  ON t_approvers(location_id, team_id) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_approver_loc_default
  ON t_approvers(location_id) WHERE team_id IS NULL;

-- (migration 001) in-app notifications.
-- PK is `id` to match both migration 001 and the queries in utils/notification.js.
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES t_user(register_id) ON DELETE CASCADE,
  ticket_id  INTEGER REFERENCES t_tickets(ticket_id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- (migration 001) ticket comments / work notes
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

-- (migration 002) activity log
CREATE TABLE IF NOT EXISTS t_activity_log (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES t_user(register_id) ON DELETE SET NULL,
  user_name     VARCHAR(255),
  activity_type VARCHAR(60) NOT NULL,
  description   TEXT,
  old_value     TEXT,
  new_value     TEXT,
  ip_address    VARCHAR(64),
  ticket_id     INTEGER,
  org_id        INTEGER,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_user    ON t_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type    ON t_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_created ON t_activity_log(created_at DESC);

COMMIT;
