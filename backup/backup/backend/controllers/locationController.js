const locationModel = require('../models/locationModel');

// CREATE
const createLocation = async (req, res) => {
    try {
        const { location_name } = req.body;
        const data = await locationModel.createLocation(location_name);
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET ALL
const getLocations = async (req, res) => {
    try {
        const data = await locationModel.getLocations();
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET BY ID
const getLocationById = async (req, res) => {
    try {
        const data = await locationModel.getLocationById(req.params.id);

        if (!data) {
            return res.status(404).json({ message: "Location not found" });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// UPDATE
const updateLocation = async (req, res) => {
    try {
        const { location_name } = req.body;

        const data = await locationModel.updateLocation(
            req.params.id,
            location_name
        );

        if (!data) {
            return res.status(404).json({ message: "Location not found" });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE
const deleteLocation = async (req, res) => {
    try {
        const data = await locationModel.deleteLocation(req.params.id);

        if (!data) {
            return res.status(404).json({ message: "Location not found" });
        }

        res.json({ message: "Location deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createLocation,
    getLocations,
    getLocationById,
    updateLocation,
    deleteLocation
};