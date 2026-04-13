const enhancedAdminUserManagementService = require("../services/enhanced-admin-user-management.service");

const getAllUsers = async (req, res) => {
  try {
    const {
      status,
      role,
      search,
      hasDeviceAssignment,
      page = 1,
      limit = 20,
    } = req.query;
    const result = await enhancedAdminUserManagementService.getAllUsers({
      status,
      role,
      search,
      hasDeviceAssignment,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.json(result);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch users",
    });
  }
};

const getUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    const result =
      await enhancedAdminUserManagementService.getUserDetail(userId);
    res.json(result);
  } catch (error) {
    console.error("Get user detail error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to fetch user details",
    });
  }
};

const createUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      role = "user",
      password,
      domains = {},
      personal_info = {},
      payment_info = {},
      system_info = {},
    } = req.body;
    const result = await enhancedAdminUserManagementService.createUser({
      fullName,
      email,
      phone,
      role,
      password,
      domains,
      personal_info,
      payment_info,
      system_info,
    });
    res.status(201).json(result);
  } catch (error) {
    console.error("Create user error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to create user",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await enhancedAdminUserManagementService.updateUser(
      userId,
      req.body,
    );
    // Service should return full user object matching original response
    res.json(result);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to update user",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await enhancedAdminUserManagementService.deleteUser(userId);
    res.json(result);
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to delete user",
    });
  }
};

const assignDeviceToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      deviceId,
      startDate,
      endDate,
      startTime,
      endTime,
      daysOfWeek,
      timezone,
      isRecurring,
      autoStartHubstaff,
      // Validate device and user exist - service will check
    } = req.body;
    const result = await enhancedAdminUserManagementService.assignDeviceToUser(
      userId,
      {
        deviceId,
        startDate,
        endDate,
        startTime,
        endTime,
        daysOfWeek,
        timezone,
        isRecurring,
        autoStartHubstaff,
      },
    );
    res.status(201).json(result);
  } catch (error) {
    console.error("Assign device error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to assign device to user",
    });
  }
};

const removeDeviceFromUser = async (req, res) => {
  try {
    const { userId, shiftId } = req.params;
    const result =
      await enhancedAdminUserManagementService.removeDeviceFromUser(
        userId,
        shiftId,
      );
    res.json(result);
  } catch (error) {
    console.error("Remove device assignment error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to remove device assignment",
    });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword, sendEmail = false } = req.body;
    const result = await enhancedAdminUserManagementService.resetUserPassword(
      userId,
      { newPassword, sendEmail },
    );
    res.json(result);
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to reset password",
    });
  }
};

const toggleUserLock = async (req, res) => {
  try {
    const { userId } = req.params;
    const result =
      await enhancedAdminUserManagementService.toggleUserLock(userId);
    res.json(result);
  } catch (error) {
    console.error("Toggle user lock error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to toggle user lock status",
    });
  }
};

const getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const result = await enhancedAdminUserManagementService.getUserSessions(
      userId,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
      },
    );
    res.json(result);
  } catch (error) {
    console.error("Get user sessions error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to get user sessions",
    });
  }
};

const getDeviceUsers = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result =
      await enhancedAdminUserManagementService.getDeviceUsers(deviceId);
    res.json(result);
  } catch (error) {
    console.error("Get device users error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to get device users",
    });
  }
};

const assignMultipleUsersToDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { assignments } = req.body;
    const result =
      await enhancedAdminUserManagementService.assignMultipleUsersToDevice(
        deviceId,
        assignments,
      );
    res.json(result);
  } catch (error) {
    console.error("Assign multiple users error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to assign multiple users to device",
    });
  }
};

const getDeviceSchedule = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const result =
      await enhancedAdminUserManagementService.getDeviceSchedule(deviceId);
    res.json(result);
  } catch (error) {
    console.error("Get device schedule error:", error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || "Failed to get device schedule",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  assignDeviceToUser,
  removeDeviceFromUser,
  resetUserPassword,
  toggleUserLock,
  getUserSessions,
  getDeviceUsers,
  assignMultipleUsersToDevice,
  getDeviceSchedule,
};
