// backend/controllers/organizationController.js
const {
  getAllOrganizations,
  getOrganizationByName,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} = require('../models/organizationModel');

// Helper — converts snake_case DB row to camelCase for frontend
const formatOrg = (org) => ({
  orgId:        org.org_id,
  orgName:      org.org_name,
  locationId:   org.location_id,
  locationName: org.location_name,
});

// GET /api/organizations  AND  GET /api/organizations/public
const getOrganizationsController = async (req, res) => {
  try {
    const orgs = await getAllOrganizations();
    res.status(200).json(orgs.map(formatOrg));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch organizations' });
  }
};

// GET /api/organizations/:id
const getOrganizationByIdController = async (req, res) => {
  try {
    const org = await getOrganizationById(req.params.id);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.status(200).json(formatOrg(org));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/organizations/by-name/:name
const getOrganizationByNameController = async (req, res) => {
  try {
    const org = await getOrganizationByName(req.params.name);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.status(200).json(formatOrg(org));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/organizations
const createOrganizationController = async (req, res) => {
  try {
    const { org_name, location_id } = req.body;
    const org = await createOrganization({ org_name, location_id });
    res.status(201).json({ message: 'Organization created successfully', org: formatOrg(org) });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ message: 'Organization name already exists' });
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/organizations/:id
const updateOrganizationController = async (req, res) => {
  try {
    const org = await updateOrganization(req.params.id, req.body);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.status(200).json({ message: 'Organization updated successfully', org: formatOrg(org) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/organizations/:id
const deleteOrganizationController = async (req, res) => {
  try {
    const org = await deleteOrganization(req.params.id);
    if (!org) return res.status(404).json({ message: 'Organization not found' });
    res.status(200).json({ message: 'Organization deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getOrganizations:      getOrganizationsController,
  getOrganizationById:   getOrganizationByIdController,
  getOrganizationByName: getOrganizationByNameController,
  createOrganization:    createOrganizationController,
  updateOrganization:    updateOrganizationController,
  deleteOrganization:    deleteOrganizationController,
};