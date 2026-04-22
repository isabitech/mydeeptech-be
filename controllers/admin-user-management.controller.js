const adminUserManagementService = require("../services/admin-user-management.service");

/**
 * GET /api/hvnc/admin/users
 * Fetch all users for user management
 */
const getAllUsers = async (req, res) => {
  try {
    const { status, role, search } = req.query;
    const data = await adminUserManagementService.getAllUsers({
      status,
      role,
      search,
    });
    res.json({
      total: data.total,
      activeCount: data.activeCount,
      lockedCount: data.lockedCount,
      inactiveCount: data.inactiveCount,
      users: data.users
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch users"
    });
  }
};

/**
 * GET /api/hvnc/admin/users/:userId
 * Get detailed user information
 */
const getUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await adminUserManagementService.getUserDetail(userId);
    res.json(data);
  } catch (error) {
    console.error("Get user detail error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch user details",
    });
  }
};

/**
 * POST /api/hvnc/admin/users
 * Create a new user
 */
const createUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      permissions,
      phone,
      timezone,
      country,
    } = req.body;

        // Validate required fields - EXACT match to original
        if (!fullName || !email || !password) {
          return res.status(400).json({
            success: false,
            error: 'Full name, email and password are required'
          });
        }

    const data = await adminUserManagementService.createUser({
      fullName,
      email,
      password,
      role,
      permissions,
      phone,
      timezone,
      country,
    });
    res.json({
      id: data.id,
      userName: data.full_name || data.fullName,
      email: data.email,
      role: data.role,
      status: 'Active',
      activeShifts: 0,
      activeSessions: 0,
      lastLogin: 'Never',
      joinedDate: data.created_at || data.createdAt,
      permissions: data.permissions
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to create user"
    });
  }
};

/**
 * PUT /api/hvnc/admin/users/:userId
 * Update user details
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      fullName,
      email,
      role,
      permissions,
      phone,
      timezone,
      country,
      isActive,
      isLocked,
    } = req.body;
    const data = await adminUserManagementService.updateUser(userId, {
      fullName,
      email,
      role,
      permissions,
      phone,
      timezone,
      country,
      isActive,
      isLocked,
    });
    res.json(data);  // Service should return full user object matching original response
  } catch (error) {
    console.error("Update user error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to update user"
    });
  }
};

/**
 * DELETE /api/hvnc/admin/users/:userId
 * Delete a user (soft delete by deactivation)
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { hardDelete = false } = req.query;
    const data = await adminUserManagementService.deleteUser(userId, {
      hardDelete: hardDelete === "true",
    });
    res.json(data);
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to delete user",
    });
  }
};

/**
 * POST /api/hvnc/admin/users/:userId/reset-password
 * Reset user password
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword, sendEmail = false } = req.body;
    const data = await adminUserManagementService.resetUserPassword(userId, {
      newPassword,
      sendEmail,
    });
    res.json(data);
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to reset password"
    });
  }
};

/**
 * POST /api/hvnc/admin/users/:userId/unlock
 * Unlock a locked user account
 */
const unlockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await adminUserManagementService.unlockUser(userId);
    res.json(data);
  } catch (error) {
    console.error("Unlock user error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to unlock user",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  unlockUser,
};
