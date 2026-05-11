// Optimized DTUser Controller Methods
// This file shows how to use the new domain relationship methods in controllers

const DTUser = require("../models/dtUser.model");

// ===============================
// BEFORE: Original dtUserLogin method (current approach)
// ===============================

// OLD METHOD - Makes separate service call to fetch domains
const dtUserLogin_OLD = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await DTUser.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // OLD APPROACH: Separate service call
    let userDomains = [];
    try {
      const domainRelationships = await DomainToUserService.fetchDomainToUserById(user._id);
      userDomains = domainRelationships.map(relation => ({
        _id: relation.domain_child._id,
        name: relation.domain_child.name,
        assignmentId: relation._id
      }));
    } catch (domainError) {
      console.log(`Failed to fetch domains for user ${user.email}:`, domainError.message);
    }

    // ... rest of login logic
    // Generate JWT and return response
  } catch (error) {
    console.error("❌ Error in login:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ===============================
// AFTER: Optimized dtUserLogin method (new approach)
// ===============================

// NEW METHOD - Uses instance method for cleaner code
const dtUserLogin_NEW = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await DTUser.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // NEW APPROACH: Use instance method (cleaner and more maintainable)
    let userDomains = [];
    try {
      userDomains = await user.getUserDomainsFormatted();
    } catch (domainError) {
      console.log(`Failed to fetch domains for user ${user.email}:`, domainError.message);
    }

    console.log("userDomains:", JSON.stringify(userDomains, null, 2));

    // ... rest of login logic
    // Generate JWT and return response with userDomains
  } catch (error) {
    console.error("❌ Error in login:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ===============================
// ALTERNATIVE: Using Virtual Field Approach
// ===============================

// VIRTUAL APPROACH - Single query with population
const dtUserLogin_VIRTUAL = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user and populate domains in a single query
    const user = await DTUser.findOne({ email }).populate({
      path: 'userDomains',
      populate: [
        { path: 'domain_category', select: 'name description' },
        { path: 'domain_child', select: 'name description' },
        { path: 'domain_sub_category', select: 'name description' }
      ]
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Format domains from virtual field
    const userDomains = user.userDomains.map(relation => ({
      _id: relation.domain_child._id,
      name: relation.domain_child.name,
      assignmentId: relation._id,
      domain_category: relation.domain_category,
      domain_sub_category: relation.domain_sub_category,
      domain_child: relation.domain_child
    }));

    console.log("userDomains:", JSON.stringify(userDomains, null, 2));

    // ... rest of login logic
  } catch (error) {
    console.error("❌ Error in login:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ===============================
// BULK OPERATIONS WITH NEW METHODS
// ===============================

// Get multiple users with their domains efficiently
const getUsersWithDomains = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    // Method 1: Using virtual field (most efficient for multiple users)
    const users = await DTUser.find({ _id: { $in: userIds } })
      .populate({
        path: 'userDomains',
        populate: [
          { path: 'domain_category', select: 'name slug' },
          { path: 'domain_child', select: 'name slug' },
          { path: 'domain_sub_category', select: 'name slug' }
        ]
      });

    const result = users.map(user => ({
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      domains: user.userDomains.map(relation => ({
        assignmentId: relation._id,
        category: relation.domain_category?.name,
        child: relation.domain_child?.name,
        subCategory: relation.domain_sub_category?.name
      }))
    }));

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("❌ Error fetching users with domains:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ===============================
// PERFORMANCE COMPARISON METHODS
// ===============================

// Method to compare performance between old and new approaches
const comparePerformance = async (userId) => {
  console.time('Old Service Approach');
  try {
    const user = await DTUser.findById(userId);
    const domainRelationships = await DomainToUserService.fetchDomainToUserById(user._id);
    const userDomainsOld = domainRelationships.map(relation => ({
      _id: relation.domain_child._id,
      name: relation.domain_child.name,
      assignmentId: relation._id
    }));
    console.timeEnd('Old Service Approach');
    console.log(`Old approach returned ${userDomainsOld.length} domains`);
  } catch (error) {
    console.timeEnd('Old Service Approach');
    console.error('Old approach error:', error.message);
  }

  console.time('New Instance Method');
  try {
    const user = await DTUser.findById(userId);
    const userDomainsNew = await user.getUserDomainsFormatted();
    console.timeEnd('New Instance Method');
    console.log(`New approach returned ${userDomainsNew.length} domains`);
  } catch (error) {
    console.timeEnd('New Instance Method');
    console.error('New approach error:', error.message);
  }

  console.time('Virtual Field Approach');
  try {
    const user = await DTUser.findById(userId).populate('userDomains');
    const userDomainsVirtual = user.userDomains;
    console.timeEnd('Virtual Field Approach');
    console.log(`Virtual approach returned ${userDomainsVirtual.length} domains`);
  } catch (error) {
    console.timeEnd('Virtual Field Approach');
    console.error('Virtual approach error:', error.message);
  }
};

module.exports = {
  dtUserLogin_OLD,
  dtUserLogin_NEW,
  dtUserLogin_VIRTUAL,
  getUsersWithDomains,
  comparePerformance
};