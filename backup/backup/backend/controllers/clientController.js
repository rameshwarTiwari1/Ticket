const {
  getAllClients,
  findClientById,
  findClientByName,
  getClientIdByName,
  addClient,
  updateClient,
  deleteClient,
} = require('../models/clientModel');

// ─── GET ALL CLIENTS ──────────────────────────────────────────────────────────
// Used by frontend to populate dropdowns — returns id + name
const getClients = async (req, res) => {
  try {
    const clients = await getAllClients();
    res.status(200).json(clients);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET CLIENT BY ID ─────────────────────────────────────────────────────────
const getClientById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await findClientById(id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    res.status(200).json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── RESOLVE NAME → ID ────────────────────────────────────────────────────────
// Frontend sends client_name → backend returns client_id
// Ticket controller calls this before inserting into T_TICKETS
const resolveClientId = async (req, res) => {
  const { client_name } = req.body;
  try {
    const client_id = await getClientIdByName(client_name);
    if (!client_id) {
      return res.status(404).json({ message: `No client found with name: "${client_name}"` });
    }

    res.status(200).json({ client_id, client_name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── CREATE CLIENT ────────────────────────────────────────────────────────────
const createClient = async (req, res) => {
  try {
    // Check duplicate before insert
    const existing = await findClientByName(req.body.client_name);
    if (existing) {
      return res.status(409).json({ message: `Client "${req.body.client_name}" already exists` });
    }

    const newClient = await addClient(req.body);
    res.status(201).json({
      message: 'Client created successfully',
      client: newClient,
    });
  } catch (err) {
    // Fallback: unique constraint violation from DB
    if (err.code === '23505') {
      return res.status(409).json({ message: `Client "${req.body.client_name}" already exists` });
    }
    res.status(500).json({ message: err.message });
  }
};

// ─── UPDATE CLIENT ────────────────────────────────────────────────────────────
const editClient = async (req, res) => {
  const { id } = req.params;
  try {
    // Check if target client exists
    const existing = await findClientById(id);
    if (!existing) return res.status(404).json({ message: 'Client not found' });

    // Check duplicate name (skip self)
    const duplicate = await findClientByName(req.body.client_name);
    if (duplicate && duplicate.client_id !== parseInt(id)) {
      return res.status(409).json({ message: `Client "${req.body.client_name}" already exists` });
    }

    const updated = await updateClient(id, req.body);
    res.status(200).json({
      message: 'Client updated successfully',
      client: updated,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `Client "${req.body.client_name}" already exists` });
    }
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE CLIENT ────────────────────────────────────────────────────────────
const removeClient = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await deleteClient(id);
    if (!deleted) return res.status(404).json({ message: 'Client not found' });

    res.status(200).json({ message: 'Client deleted successfully' });
  } catch (err) {
    // FK violation — client is referenced in T_TICKETS
    if (err.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete client — it is linked to existing tickets',
      });
    }
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getClients,
  getClientById,
  resolveClientId,
  createClient,
  editClient,
  removeClient,
};