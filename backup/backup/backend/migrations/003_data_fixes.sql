-- =============================================================================
-- Migration 003 — DATA fixes (applied by `npm run migrate`).
-- Safe + idempotent. Only touches data that is unambiguous and re-runnable.
-- Environment-specific seeding (who is admin, approver emails, user locations)
-- is intentionally NOT here — see the commented "MANUAL SEED" block at the end.
-- =============================================================================

BEGIN;

-- (1) Route DBA-category issues to the DBA team.
--     Resolved by team NAME (not a hard-coded id) so it works in any environment.
--     Review/extend the issue_name list to match your real DBA categories.
UPDATE t_issues
SET mapped_team_id = (
      SELECT team_id FROM t_teams
      WHERE LOWER(TRIM(team_name)) = 'dba'
      ORDER BY team_id LIMIT 1)
WHERE LOWER(TRIM(issue_name)) IN ('database issue', 'backup issue', 'sftp issue')
  AND EXISTS (SELECT 1 FROM t_teams WHERE LOWER(TRIM(team_name)) = 'dba');

-- (2) Repair tickets the OLD router mis-stamped onto a team in a DIFFERENT office.
--     Only UNASSIGNED tickets, and only when the issue's mapped team actually has
--     an instance at the ticket's OWN location — re-point to that correct local
--     team. Tickets already being worked (assigned) are left untouched.
UPDATE t_tickets tk
SET assigned_team_id = correct.team_id,
    updated_at       = CURRENT_TIMESTAMP
FROM t_issues i
JOIN t_teams mapped  ON mapped.team_id = i.mapped_team_id
JOIN t_teams correct ON LOWER(TRIM(correct.team_name)) = LOWER(TRIM(mapped.team_name))
                    AND correct.location_id = tk.location_id
WHERE tk.issue_id = i.issue_id
  AND tk.assigned_to IS NULL
  AND tk.assigned_team_id IS DISTINCT FROM correct.team_id;

COMMIT;

-- =============================================================================
-- MANUAL SEED — run these by hand (pgAdmin) with YOUR real values. They are NOT
-- executed by the migration runner because they are environment-specific.
--
--   -- Make your admin(s):
--   UPDATE t_user SET role = 'admin' WHERE email_id IN ('admin@yourco.com');
--
--   -- Promote a manager (also ensure their team_id + location_id are correct):
--   UPDATE t_user SET role = 'manager' WHERE email_id = 'dba.manager@yourco.com';
--
--   -- Ensure every user has a location_id (users with NULL cannot raise tickets):
--   SELECT register_id, email_id, location_id FROM t_user WHERE location_id IS NULL;
--
--   -- Seed approvers (or use the /approvers admin screen):
--   INSERT INTO t_approvers (location_id, team_id, approver_email, approver_name, is_default, is_active)
--   VALUES (<locId>, <teamId>, 'approver@yourco.com', 'Approver Name', false, true);
-- =============================================================================
