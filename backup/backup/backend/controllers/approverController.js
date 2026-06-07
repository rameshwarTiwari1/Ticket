// Admin CRUD for the approver registry (README §6).
const Approver = require('../models/approverModel');

exports.list = async (req, res) => {
  try {
    const rows = await Approver.listApprovers({
      org_id:      req.query.org_id,
      location_id: req.query.location_id,
    });
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/approvers/options — approver choices for the ticket form, filtered to
// the caller's location (or ?location_id=). Any authenticated user.
exports.options = async (req, res) => {
  try {
    const locationId = req.query.location_id || req.user?.location_id || null;
    const rows = await Approver.optionsForLocation(locationId);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { location_id, approver_email } = req.body;
    if (!location_id || !approver_email)
      return res.status(400).json({ message: 'location_id and approver_email are required' });
    const row = await Approver.createApprover(req.body);
    res.status(201).json({ message: 'Approver added', approver: row });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ message: 'An approver already exists for this location/team' });
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await Approver.updateApprover(req.params.id, req.body);
    if (!row) return res.status(404).json({ message: 'Approver not found' });
    res.status(200).json({ message: 'Approver updated', approver: row });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await Approver.deleteApprover(req.params.id);
    if (!row) return res.status(404).json({ message: 'Approver not found' });
    res.status(200).json({ message: 'Approver removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
