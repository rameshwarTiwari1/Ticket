const teamModel = require('../models/teamModel');

// GET ALL
exports.getTeams = async (req, res) => {
  try {
    const teams = await teamModel.getAllTeams();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET BY ID
exports.getTeam = async (req, res) => {
  try {
    const team = await teamModel.getTeamById(req.params.id);

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(team);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// CREATE
exports.createTeam = async (req, res) => {
  try {
    const { team_name, location_id } = req.body;

    const newTeam = await teamModel.addTeam(team_name, location_id);

    res.status(201).json(newTeam);

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({
        message: 'Team already exists for this location'
      });
    }

    res.status(500).json({ message: err.message });
  }
};

// UPDATE
exports.updateTeam = async (req, res) => {
  try {
    const { team_name, location_id } = req.body;

    const updatedTeam = await teamModel.updateTeamById(
      req.params.id,
      team_name,
      location_id
    );

    if (!updatedTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(updatedTeam);

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({
        message: 'Team already exists for this location'
      });
    }

    res.status(500).json({ message: err.message });
  }
};

// DELETE
exports.deleteTeam = async (req, res) => {
  try {

    const deletedTeam = await teamModel.deleteTeam(req.params.id);

    if (!deletedTeam) {
      return res.status(404).json({ message: `Team with id ${req.params.id} not found` });
    }

    res.json({ message: 'Team deleted successfully' });

  } catch (err) {

    // Foreign key constraint — team is linked to users
    if (err.code === '23503') {
      return res.status(400).json({
        message: 'Cannot delete team — users are assigned to this team. Reassign users first.'
      });
    }

    res.status(500).json({ message: err.message });
  }
};