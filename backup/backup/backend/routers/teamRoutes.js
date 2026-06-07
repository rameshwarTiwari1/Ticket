// backend/routes/teamRoutes.js
const express             = require('express');
const router              = express.Router();
const teamController      = require('../controllers/teamController');
const teamValidate        = require('../middlewares/teamValidate');
const authenticate        = require('../middlewares/auth');
const authorizeTeamAccess = require('../utils/authorize');

// ─── PUBLIC — no token needed (registration dropdown) ────────────────────────
router.get('/public', teamController.getTeams);

// ─── PUBLIC READ — no auth needed ────────────────────────────────────────────
router.get('/',    teamController.getTeams);
router.get('/:id', teamController.getTeam);

// ─── PROTECTED — auth + team access required ─────────────────────────────────
router.post('/',    authenticate, authorizeTeamAccess, teamValidate, teamController.createTeam);
router.put('/:id',  authenticate, authorizeTeamAccess, teamValidate, teamController.updateTeam);
router.delete('/:id', authenticate, authorizeTeamAccess, teamController.deleteTeam);

module.exports = router;