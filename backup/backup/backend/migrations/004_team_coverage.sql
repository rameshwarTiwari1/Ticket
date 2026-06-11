-- =============================================================================
-- Migration 004 — Team coverage invariant
--
-- ROOT-CAUSE FIX for the "No team is set up at your location to handle this
-- category" (NO_TEAM_MAPPING) error.
--
-- Per README §7 + §1: an issue category maps to a team TYPE, and routing resolves
-- it to the team of that name AT THE TICKET'S LOCATION (never another office —
-- the Golden Rule, §2). So ticket creation fails whenever a location is missing a
-- handling team of the required type. The fix is NOT to relax routing (that would
-- break §2/§7) but to GUARANTEE every location has the standard handling teams.
--
-- This migration ensures the four standard team TYPES exist at EVERY location.
-- Idempotent. Keep the type list in sync with:
--   - docker/db/010_seed.sql       (fresh installs)
--   - models/locationModel.js      (CORE_TEAM_TYPES — future locations)
-- =============================================================================

BEGIN;

-- Ensure the standard handling team types exist at every location.
INSERT INTO t_teams (team_name, location_id)
SELECT tn.name, l.location_id
FROM (VALUES ('Admin'), ('IT Services'), ('DBA'), ('Help Desk')) AS tn(name)
CROSS JOIN t_locations l
WHERE NOT EXISTS (
  SELECT 1 FROM t_teams t
  WHERE LOWER(TRIM(t.team_name)) = LOWER(TRIM(tn.name))
    AND t.location_id = l.location_id
);

-- Diagnostic only: warn about any issue whose mapped team TYPE is still missing
-- at some location (e.g. a specialist category like "Campaigns"). Tickets for
-- that category will correctly 400 for users at those locations until an admin
-- adds the team there. These are NOT auto-created — which teams a given office
-- has is an org-structure decision for the admin, not something a migration
-- should assume.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT te.team_name AS team_name, l.location_name AS location_name
    FROM t_issues i
    JOIN t_teams te ON te.team_id = i.mapped_team_id
    CROSS JOIN t_locations l
    WHERE NOT EXISTS (
      SELECT 1 FROM t_teams t
      WHERE LOWER(TRIM(t.team_name)) = LOWER(TRIM(te.team_name))
        AND t.location_id = l.location_id
    )
  LOOP
    RAISE NOTICE 'Team coverage gap: no "%" team at location "%" — issues routing to "%" will fail there until an admin adds that team.',
      r.team_name, r.location_name, r.team_name;
  END LOOP;
END $$;

COMMIT;
