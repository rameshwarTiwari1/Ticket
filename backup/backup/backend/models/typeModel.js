const pool = require('../config/db');

const Type = {
    getAll: async () => {
        const res = await pool.query('SELECT * FROM T_TYPES ORDER BY type_id');
        return res.rows;
    },

    getById: async (id) => {
        const res = await pool.query('SELECT * FROM T_TYPES WHERE type_id = $1', [id]);
        return res.rows[0];
    },

    create: async (type_name) => {
        const res = await pool.query(
            'INSERT INTO T_TYPES (type_name) VALUES ($1) RETURNING *',
            [type_name]
        );
        return res.rows[0];
    },

    update: async (id, type_name) => {
        const res = await pool.query(
            'UPDATE T_TYPES SET type_name = $1 WHERE type_id = $2 RETURNING *',
            [type_name, id]
        );
        return res.rows[0];
    },

    delete: async (id) => {
        const res = await pool.query('DELETE FROM T_TYPES WHERE type_id = $1 RETURNING *', [id]);
        return res.rows[0];
    }
};

module.exports = Type;
