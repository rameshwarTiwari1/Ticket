// backend/routes/teamRoutes.js
const express             = require('express');
const router              = express.Router();
const teamController      = require('../controllers/teamController');
const teamValidate        = require('../middlewares/teamValidate');
const authenticate        = require('../middlewares/auth');
const { requireAdmin }    = require('../middlewares/rbac');

// ─── PUBLIC — no token needed (registration dropdown) ────────────────────────
router.get('/public', teamController.getTeams);

// ─── PUBLIC READ — no auth needed ────────────────────────────────────────────
router.get('/',    teamController.getTeams);
router.get('/:id', teamController.getTeam);

// ─── ADMIN ONLY (README §3: Admin manages teams) ─────────────────────────────
router.post('/',    authenticate, requireAdmin, teamValidate, teamController.createTeam);
router.put('/:id',  authenticate, requireAdmin, teamValidate, teamController.updateTeam);
router.delete('/:id', authenticate, requireAdmin, teamController.deleteTeam);

module.exports = router;