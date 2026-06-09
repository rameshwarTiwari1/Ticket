-- =============================================================================
-- Migration 002 — Phase 2 (audit columns, activity log, ticket ratings)
--   psql "host=192.168.5.39 port=5432 dbname=Ticketing_Tool_Hansa user=hansa_user" -f 002_phase2.sql
-- Idempotent.
-- =============================================================================

BEGIN;

-- ─── C3: user audit columns ──────────────────────────────────────────────────
ALTER TABLE t_user
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── C5: team edit tracking ──────────────────────────────────────────────────
ALTER TABLE t_teams
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── C4: ticket rating + experience (visible to manager/admin only) ──────────
ALTER TABLE t_tickets
  ADD COLUMN IF NOT EXISTS rating      SMALLINT,           -- 1..5
  ADD COLUMN IF NOT EXISTS experience  TEXT,
  ADD COLUMN IF NOT EXISTS rated_at    TIMESTAMP;

-- ─── C2: activity log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS t_activity_log (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES t_user(register_id) ON DELETE SET NULL,
  user_name     VARCHAR(255),
  activity_type VARCHAR(60) NOT NULL,        -- LOGIN, LOGOUT, TICKET_CREATED, TICKET_STATUS, TICKET_ASSIGNED, ROLE_CHANGED, TEAM_UPDATED ...
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
