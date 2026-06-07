// backend/routes/organizationRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getOrganizations,
  getOrganizationById,
  getOrganizationByName,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} = require('../controllers/organizationController');
const authenticate        = require('../middlewares/auth');
const authorizeTeamAccess = require('../utils/authorize');
const { validate }        = require('../middlewares/organizationValidate');
const {
  createOrganizationSchema,
  updateOrganizationSchema,
} = require('../validators/organizationValidator');

// ─── PUBLIC — no token needed (registration dropdown) ────────────────────────
router.get('/public', getOrganizations);

// ─── AUTHENTICATED ────────────────────────────────────────────────────────────
router.get('/',              authenticate, getOrganizations);
router.get('/by-name/:name', authenticate, getOrganizationByName);
router.get('/:id',           authenticate, getOrganizationById);

// ─── ADMIN / IT Services only ────────────────────────────────────────────────
router.post('/',    authenticate, authorizeTeamAccess, validate(createOrganizationSchema), createOrganization);
router.put('/:id',  authenticate, authorizeTeamAccess, validate(updateOrganizationSchema), updateOrganization);
router.delete('/:id', authenticate, authorizeTeamAccess, deleteOrganization);

module.exports = router;