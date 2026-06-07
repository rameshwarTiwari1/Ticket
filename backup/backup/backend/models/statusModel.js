const pool = require('../config/db');

const TicketStatus = {
    getAll: async () => {
        const res = await pool.query('SELECT * FROM ticket_status ORDER BY status_id ASC');
        return res.rows;
    },

    getById: async (id) => {
        const res = await pool.query('SELECT * FROM ticket_status WHERE status_id = $1', [id]);
        return res.rows[0];
    },

    create: async (status_name) => {
        const res = await pool.query(
            'INSERT INTO ticket_status (status_name) VALUES ($1) RETURNING *',
            [status_name]
        );
        return res.rows[0];
    },

    update: async (id, status_name) => {
        const res = await pool.query(
            'UPDATE ticket_status SET status_name = $1, updated_at = CURRENT_TIMESTAMP WHERE status_id = $2 RETURNING *',
            [status_name, id]
        );
        return res.rows[0];
    },

    delete: async (id) => {
        const res = await pool.query('DELETE FROM ticket_status WHERE status_id = $1 RETURNING *', [id]);
        return res.rows[0];
    }
};

module.exports = TicketStatus;
