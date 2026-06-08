const express = require("express");
const router = express.Router();
const {
  getIssues,
  getIssue,
  createIssueData,
  updateIssueData,
  deleteIssueData
} = require('../controllers/issueController');

const validate = require("../middlewares/issueValidate");
const issueSchema = require("../validators/issueValidator");
const authenticate = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/rbac');

// Reads: any authenticated user (needed for ticket-form dropdowns).
router.get("/", authenticate, getIssues);
router.get("/:id", authenticate, getIssue);

// Writes: Admin only.
router.post("/", authenticate, requireAdmin, validate(issueSchema), createIssueData);
router.put("/:id", authenticate, requireAdmin, validate(issueSchema), updateIssueData);
router.delete("/:id", authenticate, requireAdmin, deleteIssueData);

module.exports = router;
