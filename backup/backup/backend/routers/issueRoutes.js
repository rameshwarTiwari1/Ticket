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

router.get("/", getIssues);
router.get("/:id", getIssue);
router.post("/", validate(issueSchema), createIssueData);
router.put("/:id", validate(issueSchema), updateIssueData);
router.delete("/:id", deleteIssueData);

module.exports = router;
