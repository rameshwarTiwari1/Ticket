const wingModel = require('../models/wingModel');

// CREATE
const createWing = async (req, res) => {
    try {
        const { wing_name, location_id } = req.body;
        const data = await wingModel.createWing(wing_name, location_id);
        res.status(201).json(data);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ message: 'Wing already exists for this location' });
        }
        res.status(500).json({ message: err.message });
    }
};

// GET ALL
const getWings = async (req, res) => {
    try {
        const data = await wingModel.getWings();
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET BY ID
const getWingById = async (req, res) => {
    try {
        const data = await wingModel.getWingById(req.params.id);
        if (!data) return res.status(404).json({ message: 'Wing not found' });
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// UPDATE
const updateWing = async (req, res) => {
    try {
        const { wing_name, location_id } = req.body;
        const data = await wingModel.updateWing(req.params.id, wing_name, location_id);
        if (!data) return res.status(404).json({ message: 'Wing not found' });
        res.json(data);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ message: 'Wing already exists for this location' });
        }
        res.status(500).json({ message: err.message });
    }
};

// DELETE
const deleteWing = async (req, res) => {
    try {
        const data = await wingModel.deleteWing(req.params.id);
        if (!data) return res.status(404).json({ message: 'Wing not found' });
        res.json({ message: 'Wing deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createWing,
    getWings,
    getWingById,
    updateWing,
    deleteWing
};