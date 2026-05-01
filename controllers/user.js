
const DTUser = require('../models/dtUser.model');
const { signupSchema, loginSchema } = require('../utils/authValidator');
const { RoleType, RolePermissions, getRolePermissionsWithDetails } = require('../utils/role')
const bcrypt = require('bcrypt');

// Signup controller
const signup = async (req, res) => {
  try {

    const { error } = signupSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { firstname, lastname, username, email, password, phone } = req.body;

    const existingUser = await DTUser.findOne({ email: req.body.email })
    const admin = await DTUser.findOne({ role: RoleType.ADMIN })
    if (existingUser) return res.status(400).json({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new DTUser({ firstname, lastname, username, email, password: hashedPassword, phone, role: RoleType.USER });
    await newUser.save();

    res.status(200).json({
      code: "90",
      message: 'User registered successfully',
      data: newUser
    });
  } catch (error) {
    console.error('Error during signup:', error); // Log the error
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login controller
const login = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { email, password } = req.body;

    const user = await DTUser.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid credentials' });

    const { password: _password, ...rest } = user.toObject(); // Convert Mongoose document to plain object

    res.status(200).json({ message: 'Login successful', user: rest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
const getAllUsers = async (req, res) => {

  const {role, search  } = req.query;
  const LIMIT = 200; // Limit to 200 users per request

    const query = {};

    query.role = role ? role.toLowerCase() : "user";

    // Add search functionality for username or email
    if (search && typeof search === 'string') {
      const searchTerm = search.trim();
      query.$or = [
        { username: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { firstname: { $regex: searchTerm, $options: 'i' } },
        { lastname: { $regex: searchTerm, $options: 'i' } },
        { fullName: { $regex: searchTerm, $options: 'i' } }
      ];
    }

  const user = await DTUser.find(query).limit(LIMIT).select('-password');

      if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found",
        data: null,
        error: null
      });
    }

    res.status(200).json({
      message: "User retrieved successfully",
      data: user,
      success: true,
      error: null
    });

};
const getUsers = async (req, res) => {
 
  try {

    const query = {};

    query.role = req.query.role.toLowerCase() ?? "user";


    // Add search functionality for username or email
    if (req.query.search) {
      const searchTerm = req.query.search;
      query.$or = [
        { username: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { firstname: { $regex: searchTerm, $options: 'i' } },
        { lastname: { $regex: searchTerm, $options: 'i' } },
        { fullName: { $regex: searchTerm, $options: 'i' } }
      ];
    }
   
    const user = await DTUser.find(query).limit(200).select('-password');

    if (!user || user.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No user found",
        data: null,
        error: "No user found",
      });
    }
  
    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
      error: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      data: null,
      error: error.message,
    });
  }
};


// Get user by ID controller
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await DTUser.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        data: null,
        error: null
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
      error: null
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
      error: error.message
    });
  }
};

// Get all roles with permissions
const getRoles = async (req, res) => {
  try {
    const roles = Object.keys(RoleType).map(key => ({
      id: key.toLowerCase(),
      name: RoleType[key].toLowerCase(),
      displayName: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase().replace('_', ' '),
      permissions: getRolePermissionsWithDetails(key),
      isEditable: RoleType[key] !== RoleType.ADMIN
    }));

    res.status(200).json({
      code: "90",
      message: "Roles retrieved successfully",
      data: roles
    });

  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
      error: error.message
    });
  }
};

// Get role statistics
const getRoleStatistics = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ];

    const stats = await DTUser.aggregate(pipeline);
    
    // Format the statistics
    const roleStats = {};
    Object.values(RoleType).forEach(role => {
      roleStats[role.toLowerCase()] = 0;
    });

    stats.forEach(stat => {
      roleStats[stat._id.toLowerCase()] = stat.count;
    });

    res.status(200).json({
      success: true,
      message: "Role statistics retrieved successfully",
      data: roleStats
    });

  } catch (error) {
    console.error('Error fetching role statistics:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      data: null,
      error: error.message
    });
  }
};



module.exports = { 
  signup, 
  login, 
  getAllUsers, 
  getUsers,
  getUserById, 
  getRoles, 
  getRoleStatistics 
};
