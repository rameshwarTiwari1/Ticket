const pool = require('../config/db');

// CREATE
const createWing = async (wing_name, location_id) => {
    const query = `
        INSERT INTO T_WINGS (wing_name, location_id)
        VALUES ($1, $2)
        RETURNING *;
    `;
    const result = await pool.query(query, [wing_name, location_id]);
    return result.rows[0];
};

// GET ALL
const getWings = async () => {
    const query = `
        SELECT w.*, l.location_name
        FROM T_WINGS w
        JOIN T_LOCATIONS l ON w.location_id = l.location_id
        ORDER BY w.wing_id;
    `;
    const result = await pool.query(query);
    return result.rows;
};

// GET BY ID
const getWingById = async (id) => {
    const query = `
        SELECT w.*, l.location_name
        FROM T_WINGS w
        JOIN T_LOCATIONS l ON w.location_id = l.location_id
        WHERE w.wing_id = $1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

// UPDATE
const updateWing = async (id, wing_name, location_id) => {
    const query = `
        UPDATE T_WINGS
        SET wing_name = $1,
            location_id = $2
        WHERE wing_id = $3
        RETURNING *;
    `;
    const result = await pool.query(query, [wing_name, location_id, id]);
    return result.rows[0];
};

// DELETE
const deleteWing = async (id) => {
    const query = `
        DELETE FROM T_WINGS
        WHERE wing_id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

module.exports = {
    createWing,
    getWings,
    getWingById,
    updateWing,
    deleteWing
};