// =============================================================================
// Activity log (notes Phase-2 #4/Logs). Fire-and-forget — never breaks the
// calling request. Records who did what, old/new values, IP, timestamp.
// =============================================================================

const db = require('../config/db');

const clientIp = (req) =>
  (req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()) ||
  req?.socket?.remoteAddress || req?.ip || null;

/**
 * @param {object} e  { user_id, user_name, activity_type, description,
 *                      old_value, new_value, ip_address, ticket_id, org_id }
 */
const log = async (e = {}) => {
  try {
    await db.query(
      `INSERT INTO t_activity_log
         (user_id, user_name, activity_type, description, old_value, new_value, ip_address, ticket_id, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        e.user_id || null, e.user_name || null, e.activity_type,
        e.description || null, e.old_value || null, e.new_value || null,
        e.ip_address || null, e.ticket_id || null, e.org_id || null,
      ]
    );
  } catch (err) {
    console.error('activityLog error:', err.message);
  }
};

// Convenience that pulls user + ip straight from req.user / req.
const logReq = (req, activity_type, fields = {}) =>
  log({
    user_id: req?.user?.userId,
    org_id: req?.user?.org_id,
    ip_address: clientIp(req),
    activity_type,
    ...fields,
  });

const list = async (filters = {}) => {
  const where = [];
  const vals = [];
  let i = 1;
  if (filters.activity_type) { where.push(`activity_type = $${i++}`); vals.push(filters.activity_type); }
  if (filters.user_id)       { where.push(`user_id = $${i++}`);       vals.push(filters.user_id); }
  if (filters.org_id)        { where.push(`org_id = $${i++}`);        vals.push(filters.org_id); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT * FROM t_activity_log ${clause} ORDER BY created_at DESC LIMIT 500`, vals
  );
  return rows;
};

module.exports = { log, logReq, list, clientIp };
