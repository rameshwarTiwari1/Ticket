// backend/models/organizationModel.js
const db = require('../config/db');

const getAllOrganizations = async () => {
  const { rows } = await db.query(`
    SELECT
      o.org_id,
      o.org_name,
      l.location_id,
      l.location_name
    FROM T_ORGANIZATION o
    JOIN T_LOCATIONS l ON l.location_id = o.location_id
    ORDER BY o.org_name
  `);
  return rows;
};

const getOrganizationByName = async (org_name) => {
  const { rows } = await db.query(`
    SELECT
      o.org_id,
      o.org_name,
      l.location_id,
      l.location_name
    FROM T_ORGANIZATION o
    JOIN T_LOCATIONS l ON l.location_id = o.location_id
    WHERE LOWER(TRIM(o.org_name)) = LOWER(TRIM($1))
    LIMIT 1
  `, [org_name]);
  return rows[0] || null;
};

const getOrganizationById = async (org_id) => {
  const { rows } = await db.query(`
    SELECT
      o.org_id,
      o.org_name,
      l.location_id,
      l.location_name
    FROM T_ORGANIZATION o
    JOIN T_LOCATIONS l ON l.location_id = o.location_id
    WHERE o.org_id = $1
    LIMIT 1
  `, [org_id]);
  return rows[0] || null;
};

const createOrganization = async ({ org_name, location_id }) => {
  const { rows } = await db.query(`
    INSERT INTO T_ORGANIZATION (org_name, location_id)
    VALUES ($1, $2)
    RETURNING *
  `, [org_name, location_id]);
  return rows[0];
};

const updateOrganization = async (org_id, { org_name, location_id }) => {
  const { rows } = await db.query(`
    UPDATE T_ORGANIZATION
    SET org_name    = COALESCE($1, org_name),
        location_id = COALESCE($2, location_id)
    WHERE org_id = $3
    RETURNING *
  `, [org_name || null, location_id || null, org_id]);
  return rows[0] || null;
};

const deleteOrganization = async (org_id) => {
  const { rows } = await db.query(`
    DELETE FROM T_ORGANIZATION WHERE org_id = $1 RETURNING *
  `, [org_id]);
  return rows[0] || null;
};

module.exports = {
  getAllOrganizations,
  getOrganizationByName,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};