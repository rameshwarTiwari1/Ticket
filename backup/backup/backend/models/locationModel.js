const pool = require('../config/db');

// CREATE
const createLocation = async (location_name) => {
    const query = `
        INSERT INTO T_LOCATIONS (location_name)
        VALUES ($1)
        RETURNING *;
    `;
    const result = await pool.query(query, [location_name]);
    return result.rows[0];
};

// READ ALL
const getLocations = async () => {
    const result = await pool.query("SELECT * FROM T_LOCATIONS ORDER BY location_id");
    return result.rows;
};

// READ ONE
const getLocationById = async (id) => {
    const result = await pool.query(
        "SELECT * FROM T_LOCATIONS WHERE location_id = $1",
        [id]
    );
    return result.rows[0];
};

// UPDATE
const updateLocation = async (id, location_name) => {
    const query = `
        UPDATE T_LOCATIONS
        SET location_name = $1
        WHERE location_id = $2
        RETURNING *;
    `;
    const result = await pool.query(query, [location_name, id]);
    return result.rows[0];
};

// DELETE
const deleteLocation = async (id) => {
    const result = await pool.query(
        "DELETE FROM T_LOCATIONS WHERE location_id = $1 RETURNING *",
        [id]
    );
    return result.rows[0];
};

module.exports = {
    createLocation,
    getLocations,
    getLocationById,
    updateLocation,
    deleteLocation
};