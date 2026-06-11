-- =============================================================================
-- seed.sql — ALL reference/master data for the ticketing system (idempotent).
-- Run by `npm run setup` (after schema + migrations). Safe to re-run.
-- Admin user is created separately by scripts/setup.js (password from env).
-- Keep team types in sync with migrations/004_team_coverage.sql & locationModel.js
-- =============================================================================
BEGIN;

-- Locations
INSERT INTO t_locations (location_name)
SELECT v.name FROM (VALUES ('Chennai'),('Mumbai Kurla'),('Mumbai Airoli')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM t_locations l WHERE LOWER(TRIM(l.location_name))=LOWER(TRIM(v.name)));

-- Organizations (linked to a location)
INSERT INTO t_organization (org_name, location_id)
SELECT v.name, (SELECT location_id FROM t_locations WHERE LOWER(TRIM(location_name))=LOWER(TRIM(v.loc)) LIMIT 1)
FROM (VALUES ('Hansa Cequity','Mumbai Kurla'),('Hansa Direct','Mumbai Airoli'),('Autosense','Chennai')) AS v(name,loc)
WHERE NOT EXISTS (SELECT 1 FROM t_organization o WHERE LOWER(TRIM(o.org_name))=LOWER(TRIM(v.name)));

-- Core handling team types at EVERY location (so routing always finds a local team)
INSERT INTO t_teams (team_name, location_id)
SELECT tn.name, l.location_id
FROM (VALUES ('Admin'),('IT Services'),('DBA'),('Help Desk')) AS tn(name)
CROSS JOIN t_locations l
WHERE NOT EXISTS (SELECT 1 FROM t_teams t WHERE LOWER(TRIM(t.team_name))=LOWER(TRIM(tn.name)) AND t.location_id=l.location_id);

-- Issue types
INSERT INTO t_types (type_name)
SELECT v.name FROM (VALUES ('IT Services'),('DBA')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM t_types t WHERE LOWER(TRIM(t.type_name))=LOWER(TRIM(v.name)));

-- Issues -> mapped handling team (by name)
INSERT INTO t_issues (issue_name, type_id, mapped_team_id)
SELECT v.name,
       (SELECT type_id FROM t_types WHERE LOWER(TRIM(type_name))=LOWER(TRIM(v.type)) LIMIT 1),
       (SELECT team_id FROM t_teams WHERE LOWER(TRIM(team_name))=LOWER(TRIM(v.team)) ORDER BY team_id LIMIT 1)
FROM (VALUES
  ('Hardware Issue','IT Services','IT Services'),
  ('Software Issue','IT Services','IT Services'),
  ('Network Issue','IT Services','IT Services'),
  ('Access Rights','IT Services','IT Services'),
  ('Email Issue','IT Services','Help Desk'),
  ('Database Issue','DBA','DBA'),
  ('Backup Issue','DBA','DBA'),
  ('SFTP Issue','DBA','DBA')
) AS v(name,type,team)
WHERE NOT EXISTS (SELECT 1 FROM t_issues i WHERE LOWER(TRIM(i.issue_name))=LOWER(TRIM(v.name)));

-- Ticket statuses (lifecycle)
INSERT INTO ticket_status (status_name)
SELECT v.name FROM (VALUES
  ('Pending Approval'),('Approved'),('Rejected'),('Open'),('In Progress'),
  ('On Hold'),('Resolved'),('Closed'),('Reopened')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM ticket_status s WHERE LOWER(TRIM(s.status_name))=LOWER(TRIM(v.name)));

-- Wings (sub-divisions, mapped to a location by name)
INSERT INTO t_wings (wing_name, location_id)
SELECT v.name, (SELECT location_id FROM t_locations WHERE LOWER(TRIM(location_name))=LOWER(TRIM(v.loc)) LIMIT 1)
FROM (VALUES ('Channei','Chennai'),('Mumbai Kurla','Mumbai Kurla'),('A','Mumbai Airoli'),('B','Mumbai Airoli'),('C','Mumbai Airoli'),('D','Mumbai Airoli')) AS v(name,loc)
WHERE NOT EXISTS (SELECT 1 FROM t_wings w WHERE LOWER(TRIM(w.wing_name))=LOWER(TRIM(v.name))
                    AND w.location_id=(SELECT location_id FROM t_locations WHERE LOWER(TRIM(location_name))=LOWER(TRIM(v.loc)) LIMIT 1));

-- Clients (account list)
INSERT INTO t_clients (client_name, organization)
SELECT v.name, v.org FROM (VALUES
  ('Hansa Cequity', 1),
  ('Hansa Direct', 2),
  ('Autosense', 2),
  ('Mahindra Farm', 2),
  ('Mahindra Powerol', 2),
  ('Mahindra Samriddhi', 2),
  ('MRC Outbound', 2),
  ('MRC WYH 6006', 2),
  ('Support', 2),
  ('Westside', 2),
  ('Hansa Cequity/Autosense', 2),
  ('ORM', 2),
  ('Training', 2),
  ('Krish-e', 2),
  ('UltraTech', 2),
  ('Cholamandalam', 2),
  ('RSA', 2),
  ('My TVS/AL', 2),
  ('Adhiraj', 2),
  ('Sarvagram', 2),
  ('Fasal', 2),
  ('CRM', 2),
  ('MIS', 2),
  ('HR', 2),
  ('Helpdesk', 2),
  ('TVS RSA CV', 3),
  ('TVS RSA PV', 3),
  ('TVS Motors', 3),
  ('Chola-INBOUND', 3),
  ('Chola-OUTBOUND', 3),
  ('Chola-Service-OUTBOUND', 3),
  ('TVS AL', 3),
  ('RIPL', 3),
  ('MFARM', 3),
  ('Mahindra and Mahindra', 3),
  ('Urban rise', 3),
  ('RSA-Quality', 3),
  ('Chola-Quality', 3),
  ('ESG-Team', 3),
  ('MIS Team', 3),
  ('Admin Team', 3),
  ('HR-team', 3),
  ('IT-Team', 3),
  ('Training Team', 3),
  ('Tata AIG - ESC', 1),
  ('TataCliq', 1),
  ('Tatasky', 1),
  ('Ultratech', 1),
  ('XUV Hola Card calling', 1),
  ('ABC-Enterprise Solutions', 1),
  ('ABSL_MF', 1),
  ('Adobe', 1),
  ('Analytics', 1),
  ('BAJAJ_AUTO', 1),
  ('BIAL', 1),
  ('BIBA', 1),
  ('Birla Estate', 1),
  ('Bluestar', 1),
  ('BSLI', 1),
  ('BTL', 1),
  ('Campaign Execution', 1),
  ('Cequity’s Data Quality Solution', 1),
  ('ELGi', 1),
  ('ELGi Ultra', 1),
  ('Enterprise Solutions', 1),
  ('Hdfc', 1),
  ('Himalaya', 1),
  ('inloyal', 1),
  ('Mahindra', 1),
  ('Mahindra Purple Club', 1),
  ('Nilkamal', 1),
  ('Reliance Nippon Life Asset', 1),
  ('Reliance Nippon Life ins', 1),
  ('Retail', 1),
  ('RoyalEnfield', 1),
  ('SBI', 1),
  ('Kotak Mahindra Bank', 1),
  ('CEQUITY-IMAGE_BANK', 1),
  ('Cequity Internal Assets', 1),
  ('Admin', 1),
  ('Campaign Responses', 1),
  ('Inorbit', 1),
  ('Standard Chartered', 1),
  ('IndiaFirst Life', 1),
  ('CHOLA-MONTRA', 3),
  ('PROCESS MANAGER', 3),
  ('Flipkart B2B', 1),
  ('Air India', 1),
  ('Palawan Pay', 1),
  ('Tata Motors', 3),
  ('Royal Enfield', 3),
  ('Extended Warranty', 2),
  ('Novel Jewels', 2),
  ('Zaggle', 2),
  ('Ask Mahindra', 2),
  ('Mahindra Solarize', 2),
  ('HOABL (Lodha)', 2),
  ('Dr Reddy', 1),
  ('The House of Angadi', 1),
  ('JCB (Japan Credit Bureau)', 1)
) AS v(name, org)
WHERE NOT EXISTS (SELECT 1 FROM t_clients c WHERE LOWER(TRIM(c.client_name))=LOWER(TRIM(v.name)));

COMMIT;
