const pool = require('../config/db');

// The standard ticket-handling team TYPES every location must have. Routing
// (README §7) resolves an issue's mapped team *type* to the team of that name AT
// the ticket's location; if the type is absent there, ticket creation fails with
// NO_TEAM_MAPPING. So every location must carry these. Keep in sync with
// docker/db/010_seed.sql and migrations/004_team_coverage.sql.
const CORE_TEAM_TYPES = ['Admin', 'IT Services', 'DBA', 'Help Desk'];

// Ensure the standard team types exist at a location (idempotent — only creates
// the ones missing). Called whenever a location is created so a new office can
// immediately handle every standard issue category at its own location.
const provisionCoreTeams = async (location_id) => {
    if (!location_id) return;
    await pool.query(
        `INSERT INTO t_teams (team_name, location_id)
         SELECT v.name, $1
         FROM unnest($2::text[]) AS v(name)
         WHERE NOT EXISTS (
           SELECT 1 FROM t_teams t
           WHERE LOWER(TRIM(t.team_name)) = LOWER(TRIM(v.name))
             AND t.location_id = $1
         )`,
        [location_id, CORE_TEAM_TYPES]
    );
};

// CREATE
const createLocation = async (location_name) => {
    const query = `
        INSERT INTO T_LOCATIONS (location_name)
        VALUES ($1)
        RETURNING *;
    `;
    const result = await pool.query(query, [location_name]);
    const location = result.rows[0];
    // Guarantee the new office has the standard handling teams so its users can
    // raise tickets immediately (no "no team at your location" error).
    await provisionCoreTeams(location.location_id);
    return location;
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