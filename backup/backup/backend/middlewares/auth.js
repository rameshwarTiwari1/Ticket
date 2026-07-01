const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // ❌ No header — 401 so the frontend interceptor logs the user out
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  // ❌ Wrong format (should be: Bearer token)
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Invalid token format' });
  }
  

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  req.user = decoded;

  // Refresh authorization fields (role / team / location / org) from the DB on
  // every request, so an Admin's change to a user (team move, role promotion,
  // location transfer) takes effect IMMEDIATELY without the user re-logging in.
  // The token still proves identity (userId); authz is always read live.
  try {
    const { rows } = await pool.query(
      `SELECT role, team_id, location_id, org_id FROM t_user WHERE register_id = $1`,
      [decoded.userId]
    );
    if (rows[0]) {
      req.user.role        = (rows[0].role || decoded.role || 'user').toLowerCase();
      req.user.team_id     = rows[0].team_id;
      req.user.location_id = rows[0].location_id;
      req.user.org_id      = rows[0].org_id ?? decoded.org_id;
    }
  } catch (e) {
    // DB hiccup — fall back to the token's values rather than block the request.
  }

  next();
};

module.exports = authenticate;
