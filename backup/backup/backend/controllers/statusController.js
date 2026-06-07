const TicketStatus = require('../models/statusModel');

const ticketStatusController = {
    getAll: async (req, res, next) => {
        try {
            const statuses = await TicketStatus.getAll();
            res.json(statuses);
        } catch (err) {
            next(err);
        }
    },

    getById: async (req, res, next) => {
        try {
            const status = await TicketStatus.getById(req.params.id);
            if (!status) return res.status(404).json({ message: 'Status not found' });
            res.json(status);
        } catch (err) {
            next(err);
        }
    },

    create: async (req, res, next) => {
        try {
            const { status_name } = req.body;
            const status = await TicketStatus.create(status_name);
            res.status(201).json(status);
        } catch (err) {
            next(err);
        }
    },

    update: async (req, res, next) => {
        try {
            const { status_name } = req.body;
            const status = await TicketStatus.update(req.params.id, status_name);
            if (!status) return res.status(404).json({ message: 'Status not found' });
            res.json(status);
        } catch (err) {
            next(err);
        }
    },

    delete: async (req, res, next) => {
        try {
            const status = await TicketStatus.delete(req.params.id);
            if (!status) return res.status(404).json({ message: 'Status not found' });
            res.json({ message: 'Status deleted successfully' });
        } catch (err) {
            next(err);
        }
    }
};

module.exports = ticketStatusController;
