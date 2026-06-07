const db = require('../config/db');

// ==================== FIND ====================

const getAllClients = async () => {
  const result = await db.query(
    `SELECT client_id, client_name, created_at, updated_at
     FROM T_CLIENTS
     ORDER BY client_name ASC`
  );
  return result.rows;
};

const findClientById = async (id) => {
  const result = await db.query(
    `SELECT client_id, client_name, created_at, updated_at
     FROM T_CLIENTS
     WHERE client_id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findClientByName = async (client_name) => {
  const result = await db.query(
    `SELECT client_id, client_name
     FROM T_CLIENTS
     WHERE LOWER(client_name) = LOWER($1)`,
    [client_name.trim()]
  );
  return result.rows[0] || null;
};

// Used by ticket module: name → id before storing
const getClientIdByName = async (client_name) => {
  const result = await db.query(
    `SELECT client_id FROM T_CLIENTS WHERE LOWER(client_name) = LOWER($1)`,
    [client_name.trim()]
  );
  return result.rows[0]?.client_id || null;
};

// ==================== CREATE ====================

const addClient = async ({ client_name }) => {
  const result = await db.query(
    `INSERT INTO T_CLIENTS (client_name)
     VALUES ($1)
     RETURNING client_id, client_name, created_at, updated_at`,
    [client_name.trim()]
  );
  return result.rows[0];
};

// ==================== UPDATE ====================

const updateClient = async (id, { client_name }) => {
  const result = await db.query(
    `UPDATE T_CLIENTS
     SET client_name = $1,
         updated_at  = CURRENT_TIMESTAMP
     WHERE client_id = $2
     RETURNING client_id, client_name, created_at, updated_at`,
    [client_name.trim(), id]
  );
  return result.rows[0] || null;
};

// ==================== DELETE ====================

const deleteClient = async (id) => {
  const result = await db.query(
    `DELETE FROM T_CLIENTS
     WHERE client_id = $1
     RETURNING client_id`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  getAllClients,
  findClientById,
  findClientByName,
  getClientIdByName,
  addClient,
  updateClient,
  deleteClient,
};