const mongoose = require('mongoose');
const envConfig = require('../config/envConfig');

// Import models
const DTUser = require('../models/dtUser.model');
const DomainCategory = require('../models/domain-category-model');
const DomainSubCategory = require('../models/domain-sub-category-model');
const DomainChild = require('../models/domain-child-model');
const DomainToUser = require('../models/domain-to-user-model');
const { RoleType } = require('../utils/role');

class MigrationVerification {
  async connectDB() {
    try {
      await mongoose.connect(envConfig.mongo.MONGO_URI);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      process.exit(1);
    }
  }

  async disconnectDB() {
    await mongoose.connection.close();
    console.log('🔐 MongoDB connection closed');
  }

  async checkCurrentState() {
    console.log('🔍 CURRENT STATE VERIFICATION');
    console.log('='.repeat(50));
    
    // Check domain structure
    console.log('\n📋 Domain Structure:');
    const categories = await DomainCategory.countDocuments({ deleted_at: null });
    const subCategories = await DomainSubCategory.countDocuments({ deleted_at: null });
    const children = await DomainChild.countDocuments({ deleted_at: null });
    const mappings = await DomainToUser.countDocuments();
    
    console.log(`   - Categories: ${categories}`);
    console.log(`   - Sub-categories: ${subCategories}`);
    console.log(`   - Domain children: ${children}`);
    console.log(`   - User mappings: ${mappings}`);
    
    // Check users with domains_of_interest
    console.log('\n👥 Users with domains_of_interest:');
    const usersWithDomains = await DTUser.find({
      'project_preferences.domains_of_interest': { $exists: true, $ne: [] }
    }).select('fullName email role project_preferences.domains_of_interest');
    
    console.log(`   Total users with domains: ${usersWithDomains.length}`);
    
    const nonAdminUsers = usersWithDomains.filter(user => user.role !== RoleType.ADMIN);
    console.log(`   Non-admin users: ${nonAdminUsers.length}`);
    
    // Show domain distribution
    const domainDistribution = {};
    usersWithDomains.forEach(user => {
      user.project_preferences.domains_of_interest.forEach(domain => {
        domainDistribution[domain] = (domainDistribution[domain] || 0) + 1;
      });
    });
    
    console.log('\n📊 Domain Distribution:');
    Object.entries(domainDistribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([domain, count]) => {
        console.log(`   ${domain}: ${count} users`);
      });
    
    // Check existing domain children names
    console.log('\n🎯 Existing Domain Children:');
    const existingChildren = await DomainChild.find({ deleted_at: null })
      .select('name domain_category')
      .populate('domain_category', 'name');
    
    if (existingChildren.length > 0) {
      existingChildren.forEach(child => {
        const categoryName = child.domain_category ? child.domain_category.name : 'No Category';
        console.log(`   ${child.name} (${categoryName})`);
      });
    } else {
      console.log('   No existing domain children found');
    }
    
    // Check users already mapped to domains
    console.log('\n🔗 Current Domain Mappings:');
    const currentMappings = await DomainToUser.find()
      .populate('user', 'fullName email')
      .populate('domain_child', 'name')
      .populate('domain_category', 'name');
    
    if (currentMappings.length > 0) {
      console.log(`   Found ${currentMappings.length} existing mappings:`);
      currentMappings.slice(0, 10).forEach(mapping => { // Show first 10
        console.log(`   ${mapping.user.fullName} -> ${mapping.domain_child.name}`);
      });
      if (currentMappings.length > 10) {
        console.log(`   ... and ${currentMappings.length - 10} more`);
      }
    } else {
      console.log('   No existing domain mappings found');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Verification completed');
  }

  async run() {
    try {
      await this.connectDB();
      await this.checkCurrentState();
    } catch (error) {
      console.error('❌ Verification failed:', error);
    } finally {
      await this.disconnectDB();
    }
  }
}

// Script execution
if (require.main === module) {
  const verification = new MigrationVerification();
  verification.run().catch(console.error);
}

module.exports = MigrationVerification;