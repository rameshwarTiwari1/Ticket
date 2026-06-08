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
const { requireAdmin }    = require('../middlewares/rbac');
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

// ─── ADMIN ONLY (README §3) ──────────────────────────────────────────────────
router.post('/',    authenticate, requireAdmin, validate(createOrganizationSchema), createOrganization);
router.put('/:id',  authenticate, requireAdmin, validate(updateOrganizationSchema), updateOrganization);
router.delete('/:id', authenticate, requireAdmin, deleteOrganization);

module.exports = router;