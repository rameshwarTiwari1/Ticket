const pool = require('../config/db');

const allowedTeams = ['admin', 'it services', 'dba'];

const authorizeTeamAccess = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No user in token' });
    }

    const result = await pool.query(
      `SELECT t.team_name
       FROM T_USER u
       JOIN T_TEAMS t ON u.team_id = t.team_id
       WHERE u.register_id = $1`,
      [userId]
    );
console.log("result",result);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const teamName = (result.rows[0].team_name || '').toLowerCase().trim();
console.log("team name", teamName);

    if (!allowedTeams.includes(teamName)) {
      return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = authorizeTeamAccess;