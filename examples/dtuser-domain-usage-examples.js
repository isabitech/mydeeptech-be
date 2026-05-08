// Example Usage of DTUser Domain Relationships
// This file demonstrates how to use the new domain relationship methods

const DTUser = require('./models/dtUser.model');

// ===============================
// EXAMPLE 1: Using Virtual Field 
// ===============================

// Get user with populated domain relationships using virtual field
async function getUserWithVirtualDomains(userId) {
  try {
    const user = await DTUser.findById(userId).populate('userDomains');
    
    console.log('User Domains (Virtual Field):');
    console.log(user.userDomains);
    
    return user;
  } catch (error) {
    console.error('Error fetching user with virtual domains:', error);
  }
}

// ===============================
// EXAMPLE 2: Using Instance Methods
// ===============================

// Get formatted user domains (matches current controller pattern)
async function getUserFormattedDomains(userId) {
  try {
    const user = await DTUser.findById(userId);
    const userDomains = await user.getUserDomainsFormatted();
    
    console.log('Formatted User Domains:');
    userDomains.forEach(domain => {
      console.log({
        domainId: domain._id,
        domainName: domain.name,
        assignmentId: domain.assignmentId,
        category: domain.domain_category?.name,
        subCategory: domain.domain_sub_category?.name
      });
    });
    
    return userDomains;
  } catch (error) {
    console.error('Error fetching formatted user domains:', error);
  }
}

// Get detailed user domains with full hierarchy
async function getUserDetailedDomains(userId) {
  try {
    const user = await DTUser.findById(userId);
    const userDomains = await user.getUserDomainsWithDetails();
    
    console.log('Detailed User Domains:');
    userDomains.forEach(relation => {
      console.log({
        relationId: relation._id,
        category: relation.domain_category,
        child: relation.domain_child,
        subCategory: relation.domain_sub_category,
        assignedAt: relation.createdAt
      });
    });
    
    return userDomains;
  } catch (error) {
    console.error('Error fetching detailed user domains:', error);
  }
}

// ===============================
// EXAMPLE 3: Using Static Methods
// ===============================

// Find all users in a specific domain
async function getUsersByDomain(domainChildId) {
  try {
    const users = await DTUser.findUsersByDomain(domainChildId);
    
    console.log(`Users in domain ${domainChildId}:`);
    users.forEach(user => {
      console.log({
        userId: user._id,
        name: user.fullName,
        email: user.email,
        annotatorStatus: user.annotatorStatus
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching users by domain:', error);
  }
}

// ===============================
// EXAMPLE 4: Advanced Query Examples
// ===============================

// Get users with their domain counts
async function getUsersWithDomainCounts() {
  try {
    const users = await DTUser.aggregate([
      {
        $lookup: {
          from: 'domaintousers', // Collection name in MongoDB (lowercase + plural)
          localField: '_id',
          foreignField: 'user',
          as: 'userDomains'
        }
      },
      {
        $addFields: {
          domainCount: { $size: '$userDomains' }
        }
      },
      {
        $project: {
          fullName: 1,
          email: 1,
          annotatorStatus: 1,
          domainCount: 1
        }
      }
    ]);
    
    console.log('Users with domain counts:');
    console.log(users);
    
    return users;
  } catch (error) {
    console.error('Error getting users with domain counts:', error);
  }
}

// Get domain statistics
async function getDomainStatistics() {
  try {
    const stats = await DTUser.aggregate([
      {
        $lookup: {
          from: 'domaintousers',
          localField: '_id',
          foreignField: 'user',
          as: 'userDomains'
        }
      },
      {
        $unwind: '$userDomains'
      },
      {
        $lookup: {
          from: 'domain_children', // Adjust collection name as needed
          localField: 'userDomains.domain_child',
          foreignField: '_id',
          as: 'domainInfo'
        }
      },
      {
        $unwind: '$domainInfo'
      },
      {
        $group: {
          _id: '$domainInfo._id',
          domainName: { $first: '$domainInfo.name' },
          userCount: { $sum: 1 },
          users: {
            $push: {
              id: '$_id',
              name: '$fullName',
              email: '$email'
            }
          }
        }
      },
      {
        $sort: { userCount: -1 }
      }
    ]);
    
    console.log('Domain Statistics:');
    console.log(stats);
    
    return stats;
  } catch (error) {
    console.error('Error getting domain statistics:', error);
  }
}

// ===============================
// EXPORT FUNCTIONS FOR USE
// ===============================

module.exports = {
  getUserWithVirtualDomains,
  getUserFormattedDomains,
  getUserDetailedDomains,
  getUsersByDomain,
  getUsersWithDomainCounts,
  getDomainStatistics
};