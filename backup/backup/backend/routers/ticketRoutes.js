const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/ticketController');
const { upload, validate } = require('../middlewares/ticketValidate');
const {
  createTicketSchema,
  updateTicketSchema,
  assignTicketSchema,
} = require('../validators/ticketValidator');
const authenticate = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/rbac');
const commentCtrl  = require('../controllers/commentController');

// ─── APPROVAL ROUTE — NO auth required (clicked from email link) ──────────────
// MUST be defined BEFORE router.use(authenticate)
router.get('/approve/:token', ctrl.handleApproval);

// All other ticket routes require authentication
router.use(authenticate);

// ─── ADMIN: run SLA breach check on demand (before /:id) ─────────────────────
router.get('/sla/check', requireAdmin, ctrl.runSlaCheck);

// ─── ASSIGN (must be before /:id) ────────────────────────────────────────────
router.post('/assign-ticket', validate(assignTicketSchema), ctrl.assignTicket);

// ─── GET user tickets (must be before /:id) ──────────────────────────────────
router.get('/user/:userId', ctrl.getTicketsForUser);

// ─── GET tickets by location (Manager branch; before /:id) ───────────────────
router.get('/location/:locationId', ctrl.getTicketsByLocation);

// ─── CREATE ───────────────────────────────────────────────────────────────────
router.post('/',
  upload.single('attachment'),
  validate(createTicketSchema),
  ctrl.create
);

// ─── ✅ NEW: GET tickets by assigned team — DBA uses this ─────────────────────
// MUST be before /:id so Express doesn't treat 'assigned-team' as a ticket ID
router.get('/assigned-team/:teamName', ctrl.getTicketsByAssignedTeam);
 
// ─── COMMENTS ────────────────────────────────────────────────────────────────
router.get('/:id/comments',  commentCtrl.getComments);
router.post('/:id/comments', commentCtrl.addComment);

// ─── READ ─────────────────────────────────────────────────────────────────────
router.get('/',    ctrl.getAllTickets);
router.get('/:id', ctrl.getById);

// ─── UPDATE ───────────────────────────────────────────────────────────────────
router.put('/:id',
  upload.single('attachment'),
  validate(updateTicketSchema),
  ctrl.update
);

// ─── DELETE ───────────────────────────────────────────────────────────────────
router.delete('/:id', ctrl.remove);

module.exports = router;
