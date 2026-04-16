const mongoose = require('mongoose');
const envConfig = require('../config/envConfig');
const DTUser = require('../models/dtUser.model');
const { RoleType } = require('../utils/role');

async function checkDomainDistribution() {
  try {
    // Connect to MongoDB
    await mongoose.connect(envConfig.mongo.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 DOMAIN DISTRIBUTION ANALYSIS');
    console.log('='.repeat(50));

    // Get total counts
    const totalUsers = await DTUser.countDocuments({});
    const nonAdminUsers = await DTUser.countDocuments({ role: { $ne: RoleType.ADMIN } });
    
    console.log(`📈 Total users: ${totalUsers}`);
    console.log(`📈 Non-admin users: ${nonAdminUsers}`);

    // Check domains field (legacy)
    const usersWithLegacyDomains = await DTUser.countDocuments({
      role: { $ne: RoleType.ADMIN },
      domains: { $exists: true, $ne: [] }
    });

    // Check project_preferences.domains_of_interest
    const usersWithDomainsOfInterest = await DTUser.countDocuments({
      role: { $ne: RoleType.ADMIN },
      'project_preferences.domains_of_interest': { $exists: true, $ne: [] }
    });

    // Check both fields combined
    const usersWithAnyDomains = await DTUser.countDocuments({
      role: { $ne: RoleType.ADMIN },
      $or: [
        { domains: { $exists: true, $ne: [] } },
        { 'project_preferences.domains_of_interest': { $exists: true, $ne: [] } }
      ]
    });

    console.log('\n🎯 DOMAIN FIELD ANALYSIS:');
    console.log(`   👥 Users with legacy 'domains' field: ${usersWithLegacyDomains}`);
    console.log(`   👥 Users with 'project_preferences.domains_of_interest': ${usersWithDomainsOfInterest}`);
    console.log(`   👥 Users with ANY domain preferences: ${usersWithAnyDomains}`);

    // Sample users with legacy domains
    console.log('\n📋 SAMPLE USERS WITH LEGACY DOMAINS:');
    const sampleLegacyUsers = await DTUser.find({
      role: { $ne: RoleType.ADMIN },
      domains: { $exists: true, $ne: [] }
    })
    .select('fullName email domains project_preferences.domains_of_interest')
    .limit(5);

    sampleLegacyUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.fullName} (${user.email})`);
      console.log(`      Legacy domains: [${user.domains.join(', ')}]`);
      const doi = user.project_preferences?.domains_of_interest || [];
      console.log(`      Domains of interest: [${doi.join(', ')}]`);
    });

    // Sample users with domains_of_interest
    console.log('\n📋 SAMPLE USERS WITH DOMAINS_OF_INTEREST:');
    const sampleDoiUsers = await DTUser.find({
      role: { $ne: RoleType.ADMIN },
      'project_preferences.domains_of_interest': { $exists: true, $ne: [] }
    })
    .select('fullName email domains project_preferences.domains_of_interest')
    .limit(5);

    sampleDoiUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.fullName} (${user.email})`);
      console.log(`      Legacy domains: [${user.domains.join(', ')}]`);
      const doi = user.project_preferences?.domains_of_interest || [];
      console.log(`      Domains of interest: [${doi.join(', ')}]`);
    });

    console.log('\n✅ Analysis completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔐 MongoDB connection closed');
  }
}

checkDomainDistribution();