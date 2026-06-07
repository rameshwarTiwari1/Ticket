const Type = require('../models/typeModel');

// GET all types
exports.getAllTypes = async (req, res, next) => {
    try {
        const types = await Type.getAll();
        res.status(200).json(types);
    } catch (error) {
        next(error);
    }
};

// GET type by ID
exports.getTypeById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const type = await Type.getById(id);
        if (!type) return res.status(404).json({ message: 'Type not found' });
        res.status(200).json(type);
    } catch (error) {
        next(error);
    }
};

// CREATE type
exports.createType = async (req, res, next) => {
    try {
        const { type_name } = req.body;
        const newType = await Type.create(type_name);
        res.status(201).json(newType);
    } catch (error) {
        next(error);
    }
};

// UPDATE type
exports.updateType = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { type_name } = req.body;
        const updatedType = await Type.update(id, type_name);
        if (!updatedType) return res.status(404).json({ message: 'Type not found' });
        res.status(200).json(updatedType);
    } catch (error) {
        next(error);
    }
};

// DELETE type
exports.deleteType = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deletedType = await Type.delete(id);
        if (!deletedType) return res.status(404).json({ message: 'Type not found' });
        res.status(200).json({ message: 'Type deleted successfully' });
    } catch (error) {
        next(error);
    }
};
