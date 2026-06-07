const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const {
  findUserByEmail,
  findUserById,
  getAllUsers,
  getUsersByOrg,
  addUser,
  updateUser,
  deleteUser,
} = require('../models/userModel');

// ── Consistent response shape ─────────────────────────────────────────────────
const formatUser = (user) => ({
  id:           user.register_id,
  employeeId:   user.employee_id,
  firstName:    user.first_name,
  lastName:     user.last_name,
  mobileNumber: user.mobile_number,
  email:        user.email_id,
  teamName:     user.team_name,
  locationName: user.location_name || null,
  wingName:     user.wing_name     || null,
  orgId:        user.org_id        || null,
  orgName:      user.org_name      || null,
  org_id:       user.org_id || null,
  location_id:  user.location_id || null

  
});

// ================= LOGIN =================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ message: 'User does not exist' });

    // const isMatch = await bcrypt.compare(password, user.password_hash);
    const isMatch = password === user.password_hash;
    console.log(password === user.password_hash);
    console.log(password,user.password_hash)
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign(
      { userId: user.register_id },
      process.env.JWT_SECRET,
      { expiresIn: '5h' }
    );

    res.status(200).json({ message: 'Login successful', user: formatUser(user), token });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ================= GET USER BY ID =================
const getUserByIdController = async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(formatUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= GET ALL USERS =================
const getUsersController = async (req, res) => {
  try {
    const { org_id } = req.query;
    const users = org_id ? await getUsersByOrg(org_id) : await getAllUsers();
    res.status(200).json(users.map(formatUser));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= CREATE USER =================
/*
  Frontend sends org_name (string).
  Backend resolves it to org_id via addUser → getOrgIdByName.
*/
const createUserController = async (req, res) => {
  try {

    const { team_name, org_name, org_id } = req.body;

    if (!team_name)
      return res.status(400).json({ message: 'Team name is required' });

    // Resolve team_id
    const teamResult = await db.query(
      `SELECT team_id FROM T_TEAMS
       WHERE LOWER(TRIM(team_name)) = LOWER(TRIM($1))`,
      [team_name]
    );
    if (!teamResult.rows.length)
      return res.status(400).json({ message: 'Invalid team name' });

    // If org_id passed directly, validate it exists
    if (org_id && !org_name) {
      const orgResult = await db.query(
        `SELECT org_id FROM T_ORGANIZATION WHERE org_id = $1`, [org_id]
      );
      if (!orgResult.rows.length)
        return res.status(400).json({ message: 'Invalid organization ID' });
    }

    // Build payload — addUser handles org_name → org_id resolution
    const payload = {
      ...req.body,
      team_id: teamResult.rows[0].team_id,
      // Pass org_name so addUser resolves it; org_id is fallback
      org_name: org_name || null,
      org_id:   org_name ? null : (org_id || null),
    };

    const newUser = await addUser(payload);
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ message: 'Email or Employee ID already exists' });
    res.status(500).json({ message: err.message });
  }
};

// ================= UPDATE USER =================
const editUserController = async (req, res) => {
  try {
    const updatedUser = await updateUser(req.params.id, req.body);
    console.log("Updated Users",updateUser);
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ 
      message: 'User updated successfully1', 
      user: formatUser(updatedUser) 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= REMOVE USER =================
const removeUserController = async (req, res) => {
  try {
    const result = await deleteUser(req.params.id);
    if (!result)
      return res.status(404).json({ message: 'User not found or has pending tickets' });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    if (err.requiresReassign) {
      return res.status(400).json({
        message:         err.message,
        requiresReassign: true,
        pendingCount:    err.pendingCount,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

// ================= REASSIGN TICKETS =================
const reassignTicketsController = async (req, res) => {
  const { oldUserId, newUserId } = req.body;
  try {
    await db.query(
      `UPDATE t_tickets SET assigned_to=$1 WHERE assigned_to=$2`,
      [newUserId, oldUserId]
    );
    res.status(200).json({ message: 'Tickets reassigned successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= DELETE USER WITH REASSIGN =================
const deleteUserWithReassignController = async (req, res) => {
  const userId = req.params.id;
  const { newUserId } = req.body;
  try {
    await deleteUser(userId, newUserId);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    if (err.requiresReassign) {
      return res.status(400).json({
        message:         err.message,
        requiresReassign: true,
        pendingCount:    err.pendingCount,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  login,
  getUserById:            getUserByIdController,
  getUsers:               getUsersController,
  createUser:             createUserController,
  editUser:               editUserController,
  removeUser:             removeUserController,
  reassignTickets:        reassignTicketsController,
  deleteUserWithReassign: deleteUserWithReassignController,
};