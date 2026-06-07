const pool = require('../config/db');

// GET ALL
const getAllTeams = async () => {
  const res = await pool.query(`
    SELECT t.*, l.location_name
    FROM T_TEAMS t
    LEFT JOIN T_LOCATIONS l ON t.location_id = l.location_id
    ORDER BY t.team_id
  `);
  return res.rows;
};

// GET BY ID
const getTeamById = async (id) => {
  const res = await pool.query(
    `SELECT * FROM T_TEAMS WHERE team_id = $1`,
    [id]
  );
  return res.rows[0];
};

// CREATE (🔥 includes location_id)
const addTeam = async (team_name, location_id) => {
  const res = await pool.query(
    `INSERT INTO T_TEAMS (team_name, location_id)
     VALUES ($1, $2)
     RETURNING *`,
    [team_name, location_id]
  );
  return res.rows[0];
};

// UPDATE
const updateTeamById = async (id, team_name, location_id) => {
  const res = await pool.query(
    `UPDATE T_TEAMS
     SET team_name = $1,
         location_id = $2
     WHERE team_id = $3
     RETURNING *`,
    [team_name, location_id, id]
  );
  return res.rows[0];
};

// DELETE
const deleteTeam = async (id) => {
  const res = await pool.query(
    `DELETE FROM T_TEAMS WHERE team_id = $1 RETURNING *`,
    [id]
  );
  return res.rows[0];
};

module.exports = {
  getAllTeams,
  getTeamById,
  addTeam,
  updateTeamById,
  deleteTeam,
};