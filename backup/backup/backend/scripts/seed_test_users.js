// =============================================================================
// Seed TEST users (manager / employee / requester) for every handling team, so
// the full ticket flow can be exercised. Idempotent (skips existing emails).
//
//   npm run seed:test
//
// All users share one password (TEST_PASSWORD env, default "Test@123") and live
// at one location+org so manager/employee/requester relationships line up:
//   location = Mumbai Kurla,  org = Hansa Cequity
//
// NOT part of the production seed — run only in dev/test environments.
// =============================================================================

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

const LOCATION = 'Mumbai Kurla';
const ORG      = 'Hansa Cequity';
const PASSWORD = process.env.TEST_PASSWORD || 'Test@123';

// [team, role, email, first, last]
const USERS = [
  ['IT Services', 'manager',  'it.manager@hansa.local',   'IT',   'Manager'],
  ['IT Services', 'employee', 'it.employee@hansa.local',  'IT',   'Employee'],
  ['DBA',         'manager',  'dba.manager@hansa.local',  'DBA',  'Manager'],
  ['DBA',         'employee', 'dba.employee@hansa.local', 'DBA',  'Employee'],
  ['Help Desk',   'manager',  'help.manager@hansa.local', 'Help', 'Manager'],
  ['Help Desk',   'employee', 'help.employee@hansa.local','Help', 'Employee'],
  ['IT Services', 'user',     'user1@hansa.local',        'User', 'One'],
  ['IT Services', 'user',     'user2@hansa.local',        'User', 'Two'],
];

(async () => {
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    let created = 0, skipped = 0;
    for (let i = 0; i < USERS.length; i++) {
      const [team, role, email, first, last] = USERS[i];
      const res = await pool.query(
        `INSERT INTO t_user
           (employee_id, first_name, last_name, mobile_number,
            team_id, location_id, email_id, password_hash, is_verified, org_id, role)
         SELECT $1, $2, $3, '0000000000',
           (SELECT t.team_id FROM t_teams t JOIN t_locations l ON l.location_id=t.location_id
             WHERE LOWER(TRIM(t.team_name))=LOWER(TRIM($4)) AND LOWER(TRIM(l.location_name))=LOWER(TRIM($5)) LIMIT 1),
           (SELECT location_id FROM t_locations WHERE LOWER(TRIM(location_name))=LOWER(TRIM($5)) LIMIT 1),
           $6, $7, TRUE,
           (SELECT org_id FROM t_organization WHERE LOWER(TRIM(org_name))=LOWER(TRIM($8)) LIMIT 1),
           $9
         ON CONFLICT (email_id) DO NOTHING
         RETURNING register_id`,
        [`TEST${100 + i}`, first, last, team, LOCATION, email, hash, ORG, role]
      );
      if (res.rows.length) { created++; console.log(`✓ ${role.padEnd(8)} ${team.padEnd(12)} ${email}`); }
      else { skipped++; console.log(`= exists   ${email}`); }
    }
    console.log(`\nDone — ${created} created, ${skipped} already existed.`);
    console.log(`All test users password: ${PASSWORD}`);
    process.exit(0);
  } catch (e) {
    console.error('seed:test failed:', e.message);
    process.exit(1);
  }
})();
