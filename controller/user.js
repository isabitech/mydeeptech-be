const { response } = require('express');
const User = require('../models/user');
const { signupSchema, loginSchema } = require('../utils/authValidator');
const { RoleType, RolePermissions, getRolePermissionsWithDetails } = require('../utils/role')
const bcrypt = require('bcrypt');

// Signup controller
const signup = async (req, res) => {
  try {
    const { error } = signupSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { firstname, lastname, username, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email: req.body.email })
    const admin = await User.findOne({ role: RoleType.ADMIN })
    if (existingUser) return res.status(400).json({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ firstname, lastname, username, email, password: hashedPassword, phone, role: RoleType.USER });
    await newUser.save();

    res.status(200).send({
      responseCode: "90",
      responseMessage: 'User registered successfully',
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

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid credentials' });

    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
const getAllUsers = async (req, res) => {
  const user = await User.find({ role: req.params.role });
  try {
    if (!user) {
      return res.status(400).send({
        responseCode: "90",
        responseMessage: "No user found",
        data: null,
      });
    }

    res.status(200).send({
      responseCode: "90",
      responseMessage: "User retrieved successfully",
      data: user
    });
  } catch (error) {
    res.status(500).send({
      responseCode: "90",
      responseMessage: "Internal server error",
      data: error.message,
    });

    console.log(error);
  }
};
const getUsers = async (req, res) => {
 
  try {
    const query = {};

    if (req.query.role) {
      query.role = req.query.role.toUpperCase();
    }
   
    // const user = await User.find(query);
    const user = await User.find(query).select('-password');

    if (!user || user.length === 0) {
      return res.status(400).send({
        responseCode: "99",
        responseMessage: "No user found",
        data: null,
      });
    }
    // const sanitizedUsers = user.map(user => {
    //   const userObj = user.toObject(); 
    //   delete userObj.password;
    //   return userObj;
    // });
  

    
    res.status(200).send({
      responseCode: "90",
      responseMessage: "User retrieved successfully",
      data: user
    });
  } catch (error) {
    res.status(500).send({
      responseCode: "99",
      responseMessage: "Internal server error",
      data: error.message,
    });

    console.log(error);
  }
};


// Get user by ID controller
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        responseCode: "99",
        responseMessage: "User not found",
        data: null
      });
    }

    res.status(200).json({
      responseCode: "90",
      responseMessage: "User retrieved successfully",
      data: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      responseCode: "99",
      responseMessage: "Internal server error",
      data: error.message
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
      responseCode: "90",
      responseMessage: "Roles retrieved successfully",
      data: roles
    });

  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      responseCode: "99",
      responseMessage: "Internal server error",
      data: error.message
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

    const stats = await User.aggregate(pipeline);
    
    // Format the statistics
    const roleStats = {};
    Object.values(RoleType).forEach(role => {
      roleStats[role.toLowerCase()] = 0;
    });

    stats.forEach(stat => {
      roleStats[stat._id.toLowerCase()] = stat.count;
    });

    res.status(200).json({
      responseCode: "90",
      responseMessage: "Role statistics retrieved successfully",
      data: roleStats
    });

  } catch (error) {
    console.error('Error fetching role statistics:', error);
    res.status(500).json({
      responseCode: "99",
      responseMessage: "Internal server error",
      data: error.message
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
