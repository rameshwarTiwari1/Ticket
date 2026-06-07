// =============================================================================
// Role-based access middleware. Use after `authenticate` (which sets req.user).
// Roles come from the JWT (enriched at login). See constants/roles.js.
// =============================================================================

const { ROLES, norm } = require('../constants/roles');
const access = require('../utils/access');

// Allow only the listed roles.
const requireRole = (...roles) => (req, res, next) => {
  const role = norm(req.user?.role);
  if (!role) return res.status(401).json({ message: 'Unauthorized: no role in token' });
  if (!roles.map(norm).includes(role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient role' });
  }
  next();
};

const requireAdmin          = requireRole(ROLES.ADMIN);
const requireManagerOrAdmin = requireRole(ROLES.ADMIN, ROLES.MANAGER);

module.exports = { requireRole, requireAdmin, requireManagerOrAdmin, access };
