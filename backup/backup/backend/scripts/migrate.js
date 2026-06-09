// =============================================================================
// Migration runner.   Usage:  npm run migrate         (apply all pending)
//                             npm run migrate:status   (list applied/pending)
//
// Applies every numbered file in backend/migrations (001_*.sql, 002_*.sql, …)
// in filename order, exactly once. Tracks applied files in `schema_migrations`.
// Each .sql file carries its own BEGIN/COMMIT and is idempotent (IF NOT EXISTS),
// so re-running is always safe.
// =============================================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const statusOnly = process.argv.includes('--status');

const migrationFiles = () =>
  fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/i.test(f))   // numbered files only (ignores helpers)
    .sort();

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files   = migrationFiles();
    const applied = new Set(
      (await pool.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename)
    );

    if (statusOnly) {
      console.log('\nMigration status:');
      for (const f of files) console.log(`  ${applied.has(f) ? '✓ applied ' : '• pending '}  ${f}`);
      console.log('');
      process.exit(0);
    }

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) { console.log(`= already applied: ${file}`); continue; }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`→ applying: ${file}`);
      try {
        await pool.query(sql);                                   // file has its own BEGIN/COMMIT
        await pool.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [file]);
        console.log(`✓ applied:  ${file}`);
        ran++;
      } catch (err) {
        console.error(`✗ FAILED:   ${file}\n   ${err.message}`);
        console.error('Stopping. Fix the error and re-run `npm run migrate`.');
        process.exit(1);
      }
    }

    console.log(`\nDone — ${ran} applied, ${files.length - ran} already up to date.`);
    process.exit(0);
  } catch (e) {
    console.error('Migration runner error:', e.message);
    process.exit(1);
  }
})();
