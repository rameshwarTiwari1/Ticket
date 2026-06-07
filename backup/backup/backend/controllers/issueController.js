const {
  getAllIssues,
  getIssueById,
  addIssue,
  updateIssue,
  deleteIssue,
} = require('../models/issueModel');

const getIssues = async (req, res) => {
  try {
    const issues = await getAllIssues();
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getIssue = async (req, res) => {
  const id = parseInt(req.params.id); // Ensure id is a number
  try {
    const issue = await getIssueById(id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json(issue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createIssueData = async (req, res) => {
  try {
    const newIssue = await addIssue(req.body);
    res.status(201).json(newIssue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateIssueData = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const updatedIssue = await updateIssue(id, req.body);
    if (!updatedIssue) return res.status(404).json({ message: 'Issue not found' });
    res.json(updatedIssue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteIssueData = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const deletedIssue = await deleteIssue(id);
    if (!deletedIssue) return res.status(404).json({ message: 'Issue not found' });
    res.json({ message: 'Issue deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getIssues,
  getIssue,
  createIssueData,
  updateIssueData,
  deleteIssueData
};
