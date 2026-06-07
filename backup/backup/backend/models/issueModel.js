const pool = require('../config/db');

const getAllIssues = async () => {
  const res = await pool.query('SELECT * FROM T_ISSUES ORDER BY issue_id');
  return res.rows;
};

const getIssueById = async (id) => {
  const res = await pool.query('SELECT * FROM T_ISSUES WHERE issue_id = $1', [id]);
  return res.rows[0];
};

const addIssue = async ({ issue_name, type_id, mapped_team_id }) => {
  const res = await pool.query(
    `INSERT INTO T_ISSUES (issue_name, type_id, mapped_team_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [issue_name, type_id, mapped_team_id]
  );
  return res.rows[0];
};

const updateIssue = async (id, { issue_name, type_id, mapped_team_id }) => {
  const res = await pool.query(
    `UPDATE T_ISSUES
     SET issue_name = $1, type_id = $2, mapped_team_id = $3
     WHERE issue_id = $4 RETURNING *`,
    [issue_name, type_id, mapped_team_id, id]
  );
  return res.rows[0];
};

const deleteIssue = async (id) => {
  const res = await pool.query(
    'DELETE FROM T_ISSUES WHERE issue_id = $1 RETURNING *',
    [id]
  );
  return res.rows[0];
};

module.exports = {
  getAllIssues,
  getIssueById,
  addIssue,
  updateIssue,
  deleteIssue,
};
