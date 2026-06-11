// =============================================================================
// One-command full bootstrap for a FRESH database.
//
//   npm run setup
//
// Runs, in order (all idempotent — safe to re-run on an existing DB):
//   1. db/schema.sql      — create every table/column (IF NOT EXISTS)
//   2. migrations/*.sql    — apply + record pending numbered migrations
//   3. db/seed.sql         — all reference/master data (orgs, locations, teams
//                            at every location, types, issues, statuses, wings,
//                            clients)
//   4. admin user          — created with a bcrypt-hashed password
//
// Admin credentials come from env (ADMIN_EMAIL / ADMIN_PASSWORD); defaults are
// used if unset. CHANGE THE PASSWORD for a real production deployment.
//
// For an EXISTING prod DB that already has data, prefer `npm run migrate` (just
// the incremental migrations) — `setup` is for a clean bootstrap.
// =============================================================================

require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

const DB_DIR  = path.join(__dirname, '../db');
const MIG_DIR = path.join(__dirname, '../migrations');

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@hansa.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

const runSqlFile = async (file, label) => {
  await pool.query(fs.readFileSync(file, 'utf8'));
  console.log(`✓ ${label}`);
};

const runMigrations = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  const applied = new Set(
    (await pool.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
  );
  const files = fs.readdirSync(MIG_DIR).filter((f) => /^\d+.*\.sql$/i.test(f)).sort();
  for (const f of files) {
    if (applied.has(f)) { console.log(`= migration already applied: ${f}`); continue; }
    await pool.query(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'));
    await pool.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [f]);
    console.log(`✓ migration applied: ${f}`);
  }
};

// Create the initial admin (idempotent). Located at the Admin team's location so
// team/location are consistent; org defaults to the first organization.
const ensureAdmin = async () => {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const res = await pool.query(
    `INSERT INTO t_user
       (employee_id, first_name, last_name, mobile_number,
        team_id, location_id, email_id, password_hash, is_verified, org_id, role)
     SELECT 'ADM001', 'System', 'Admin', '0000000000',
       (SELECT team_id     FROM t_teams WHERE LOWER(TRIM(team_name)) = 'admin' ORDER BY team_id LIMIT 1),
       (SELECT location_id FROM t_teams WHERE LOWER(TRIM(team_name)) = 'admin' ORDER BY team_id LIMIT 1),
       $1, $2, TRUE,
       (SELECT org_id FROM t_organization ORDER BY org_id LIMIT 1),
       'admin'
     ON CONFLICT (email_id) DO NOTHING
     RETURNING register_id`,
    [ADMIN_EMAIL, hash]
  );
  console.log(res.rows.length ? `✓ admin created: ${ADMIN_EMAIL}` : `= admin already exists: ${ADMIN_EMAIL}`);
};

(async () => {
  try {
    console.log('▶ Bootstrapping database (schema → migrations → seed → admin)…\n');
    await runSqlFile(path.join(DB_DIR, 'schema.sql'), 'schema applied');
    await runMigrations();
    await runSqlFile(path.join(DB_DIR, 'seed.sql'), 'reference data seeded');
    await ensureAdmin();
    console.log(`\n✅ Setup complete. Admin login: ${ADMIN_EMAIL}` +
                (process.env.ADMIN_PASSWORD ? '  (password from ADMIN_PASSWORD)' : `  /  ${ADMIN_PASSWORD}`));
    process.exit(0);
  } catch (e) {
    console.error('\n✗ Setup failed:', e.message);
    process.exit(1);
  }
})();
