// =============================================================================
// One-time script: bcrypt-hash any remaining PLAINTEXT passwords in T_USER.
// Safe to run multiple times — rows already hashed ($2a/$2b/$2y) are skipped.
//
//   node scripts/migrate_passwords.js
//
// Login also upgrades plaintext passwords lazily on next sign-in, so this script
// is only needed to migrate accounts that haven't logged in yet.
// =============================================================================

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

(async () => {
  try {
    const { rows } = await pool.query(
      `SELECT register_id, email_id, password_hash FROM t_user`
    );
    let migrated = 0, skipped = 0;
    for (const u of rows) {
      const stored = u.password_hash || '';
      if (/^\$2[aby]\$/.test(stored)) { skipped++; continue; }
      const hash = await bcrypt.hash(stored, 10);
      await pool.query(
        `UPDATE t_user SET password_hash = $1 WHERE register_id = $2`,
        [hash, u.register_id]
      );
      migrated++;
      console.log(`hashed: ${u.email_id}`);
    }
    console.log(`\nDone. migrated=${migrated} alreadyHashed=${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('migration failed:', err);
    process.exit(1);
  }
})();
