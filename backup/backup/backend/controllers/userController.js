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
  setUserRole,
  changeUserLocation,
  getAssignableUsers,
} = require('../models/userModel');

// ── Consistent response shape ─────────────────────────────────────────────────
const formatUser = (user) => ({
  id:           user.register_id,
  employeeId:   user.employee_id,
  firstName:    user.first_name,
  lastName:     user.last_name,
  mobileNumber: user.mobile_number,
  email:        user.email_id,
  role:         (user.role || 'user').toLowerCase(),
  teamName:     user.team_name,
  teamId:       user.team_id || null,
  locationName: user.location_name || null,
  locationId:   user.location_id   || null,   // ✅ ADD
  wingName:     user.wing_name     || null,
  wingId:       user.wing_id       || null,   // ✅ ADD
  orgId:        user.org_id        || null,
  org_id:        user.org_id        || null,
  orgName:      user.org_name      || null,
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

    // Passwords created via admin "addUser" are already bcrypt-hashed; legacy
    // ones from /auth/register may be plaintext. Verify with bcrypt when hashed,
    // otherwise compare plaintext once and lazily upgrade it to a bcrypt hash.
    const stored = user.password_hash || '';
    const looksHashed = /^\$2[aby]\$/.test(stored);
    let isMatch = false;

    if (looksHashed) {
      isMatch = await bcrypt.compare(password, stored);
    } else {
      isMatch = password === stored;
      if (isMatch) {
        try {
          const upgraded = await bcrypt.hash(password, 10);
          await db.query(
            `UPDATE T_USER SET password_hash = $1 WHERE register_id = $2`,
            [upgraded, user.register_id]
          );
        } catch (e) {
          console.error('password hash upgrade failed:', e.message);
        }
      }
    }

    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    const token = jwt.sign(
      {
        userId:      user.register_id,
        role:        (user.role || 'user').toLowerCase(),
        org_id:      user.org_id,
        team_id:     user.team_id,
        team_name:   user.team_name,
        location_id: user.location_id,
      },
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
    console.log("org_id", req.params.id);
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
// const editUserController = async (req, res) => {
//   try {
//     const updatedUser = await updateUser(req.params.id, req.body);
//     console.log("Updated Users",updateUser);
//     if (!updatedUser) return res.status(404).json({ message: 'User not found' });
//     res.status(200).json({ 
//       message: 'User updated successfully1', 
//       user: formatUser(updatedUser) 
//     });
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

const editUserController = async (req, res) => {
  try {
    console.log('User ID:', req.params.id);
    console.log('Request Body:', req.body);

    const updatedUser = await updateUser(req.params.id, req.body);

    console.log('Updated User:', updatedUser);

    if (!updatedUser) {
      console.log('User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User updated successfully',
      user: formatUser(updatedUser)
    });
  } catch (err) {
    console.error('Update Error:', err);
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

// ================= PROMOTE / SET ROLE (Admin only) =================
// Admin grants the Manager role (or any role) to a user. README §3.
const setRoleController = async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ['admin', 'manager', 'employee', 'user'];
    if (!allowed.includes((role || '').toLowerCase()))
      return res.status(400).json({ message: `role must be one of: ${allowed.join(', ')}` });

    const updated = await setUserRole(req.params.id, role.toLowerCase());
    if (!updated) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: `Role updated to ${role}`, user: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= TRANSFER USER LOCATION (Admin only) =================
// Old tickets keep their original location; new tickets follow the new one. README §8.
const transferLocationController = async (req, res) => {
  try {
    const { location_id } = req.body;
    if (!location_id) return res.status(400).json({ message: 'location_id is required' });

    const result = await changeUserLocation(
      req.params.id, location_id, req.user?.userId || null
    );
    res.status(200).json({ message: 'User location transferred', ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ASSIGNABLE USERS (Manager/Admin) =================
// Employees a Manager may assign to: their own team + location.
const assignableUsersController = async (req, res) => {
  try {
    const { access } = require('../middlewares/rbac');
    let teamId, locationId;
    if (access.isAdmin(req.user)) {
      teamId     = req.query.team_id;
      locationId = req.query.location_id;
      if (!teamId || !locationId)
        return res.status(400).json({ message: 'team_id and location_id are required for admin' });
    } else {
      teamId     = req.user.team_id;
      locationId = req.user.location_id;
    }
    const users = await getAssignableUsers(teamId, locationId);
    res.status(200).json(users.map(formatUser));
  } catch (err) {
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
  setRole:                setRoleController,
  transferLocation:       transferLocationController,
  getAssignableUsers:     assignableUsersController,
};