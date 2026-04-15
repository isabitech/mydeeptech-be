const mongoose = require('mongoose');
const envConfig = require('../config/envConfig');

// Import all required models in proper order
const DTUser = require('../models/dtUser.model');
const DomainCategory = require('../models/domain-category-model');
const DomainSubCategory = require('../models/domain-sub-category-model');
const DomainChild = require('../models/domain-child-model');
const DomainToUser = require('../models/domain-to-user-model');

const DomainMigration = require('./migrate-domains-of-interest');
const { RoleType } = require('../utils/role');

// Sample domain preferences for testing
const SAMPLE_DOMAIN_PREFERENCES = [
  {
    fullName: "John Doe (Test User)",
    email: "john.test@example.com", 
    domains: ["Technology", "Science", "Coding"]
  },
  {
    fullName: "Jane Smith (Test User)",
    email: "jane.test@example.com",
    domains: ["Arts and Entertainment", "Education", "Health"]
  },
  {
    fullName: "Bob Wilson (Test User)", 
    email: "bob.test@example.com",
    domains: ["Finance", "Math", "Computing"]
  },
  {
    fullName: "Alice Brown (Test User)",
    email: "alice.test@example.com", 
    domains: ["Environment", "Science", "Travel"]
  },
  {
    fullName: "Charlie Davis (Test User)",
    email: "charlie.test@example.com",
    domains: ["Coding - Tool Use", "Information Technology", "STEM"]
  }
];

class MigrationDemo {
  constructor() {
    this.testUserIds = [];
    this.dryRun = true;
  }

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

  async createTestUsers() {
    console.log('\n🧪 Creating test users with domain preferences...');
    
    for (const userTemplate of SAMPLE_DOMAIN_PREFERENCES) {
      try {
        // Check if test user already exists
        const existingUser = await DTUser.findOne({ email: userTemplate.email });
        
        if (existingUser) {
          console.log(`   ♻️  Test user already exists: ${userTemplate.fullName}`);
          
          // Update existing test user with domains
          existingUser.project_preferences.domains_of_interest = userTemplate.domains;
          await existingUser.save();
          this.testUserIds.push(existingUser._id);
        } else {
          // Create new test user
          const testUser = new DTUser({
            fullName: userTemplate.fullName,
            email: userTemplate.email,
            phone: "1234567890",
            role: RoleType.USER,
            consent: true,
            project_preferences: {
              domains_of_interest: userTemplate.domains,
              availability_type: "part_time",
              nda_signed: false
            },
            personal_info: {
              country: "Test Country",
              time_zone: "UTC"
            }
          });
          
          await testUser.save();
          this.testUserIds.push(testUser._id);
          console.log(`   ✅ Created test user: ${userTemplate.fullName} with domains: ${userTemplate.domains.join(', ')}`);
        }
      } catch (error) {
        console.error(`   ❌ Error creating test user ${userTemplate.fullName}:`, error.message);
      }
    }
    
    console.log(`   📊 Total test users created/updated: ${this.testUserIds.length}`);
  }

  async runMigrationDemo() {
    console.log('\n🎬 Running migration demonstration...');
    console.log('=' * 50);
    
    const migration = new DomainMigration();
    migration.dryRun = this.dryRun;
    
    try {
      await migration.connectDB();
      
      console.log('🚀 Starting Domain Migration Process');
      console.log(`Mode: ${migration.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
      
      // Step 1: Fetch existing domains
      const existingDomains = await migration.fetchExistingDomains();
      
      // Step 2: Find affected users
      const affectedUsers = await migration.findAffectedUsers();
      
      if (affectedUsers.length === 0) {
        console.log('\n✅ No users found with domains_of_interest to migrate');
        return;
      }
      
      // Step 3: Map domain options to domain children
      const { mapping, domainsToCreate, generalCategory } = await migration.mapDomainOptionsToChildren(existingDomains);
      
      // Step 4: Show preview
      await migration.showMigrationPreview(affectedUsers, mapping, generalCategory);
      
      if (!migration.dryRun) {
        // Step 5: Create missing domains
        const createdDomains = await migration.createMissingDomains(domainsToCreate);
        
        // Step 6: Perform migration
        await migration.performMigration(affectedUsers, mapping, createdDomains);
        
        // Step 7: Generate report
        await migration.generateReport();
      }
      
      await migration.disconnectDB();
      
    } catch (error) {
      console.error('❌ Migration demo failed:', error);
    }
  }

  async cleanupTestUsers() {
    console.log('\n🧹 Cleaning up test users...');
    
    try {
      const deleteResult = await DTUser.deleteMany({ 
        _id: { $in: this.testUserIds } 
      });
      console.log(`   ✅ Deleted ${deleteResult.deletedCount} test users`);
    } catch (error) {
      console.error(`   ❌ Error cleaning up test users:`, error.message);
    }
  }

  async showCurrentMigrationStatus() {
    console.log('\n📊 CURRENT MIGRATION STATUS');
    console.log('='.repeat(50));
    
    // Check domain mapping counts
    const mappingCount = await DomainToUser.countDocuments();
    
    // Check users with domains_of_interest
    const usersWithDomains = await DTUser.countDocuments({
      'project_preferences.domains_of_interest': { $exists: true, $ne: [] }
    });
    
    console.log(`📈 Current Status:`);
    console.log(`   - Users with domain preferences: ${usersWithDomains}`);
    console.log(`   - Domain-to-user mappings: ${mappingCount}`);
    
    if (mappingCount > 0) {
      console.log('\n🔗 Recent Mappings:');
      const recentMappings = await DomainToUser.find()
        .populate('user', 'fullName email')
        .populate('domain_child', 'name')
        .sort({ createdAt: -1 })
        .limit(5);
      
      recentMappings.forEach(mapping => {
        console.log(`   ${mapping.user.fullName} -> ${mapping.domain_child.name}`);
      });
    }
  }

  async run() {
    try {
      await this.connectDB();
      
      console.log('🎯 Domain Migration Demonstration');
      console.log(`Mode: ${this.dryRun ? 'DRY RUN (Safe)' : 'LIVE MIGRATION (Will modify data)'}`);
      
      // Show current status
      await this.showCurrentMigrationStatus();
      
      // Create test users with domain preferences
      await this.createTestUsers();
      
      // Run the migration demonstration
      await this.runMigrationDemo();
      
      // Show final status
      await this.showCurrentMigrationStatus();
      
      // Cleanup test users (only if dry run)
      if (this.dryRun) {
        await this.cleanupTestUsers();
      } else {
        console.log('\n⚠️  Test users left in database for verification. Clean up manually if needed.');
        console.log('   Test user emails:', SAMPLE_DOMAIN_PREFERENCES.map(u => u.email).join(', '));
      }
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      await this.disconnectDB();
    }
  }
}

// Script execution
if (require.main === module) {
  const demo = new MigrationDemo();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--live')) {
    demo.dryRun = false;
    console.log('⚠️  LIVE DEMO MODE ENABLED - Will create actual domain mappings');
  } else {
    console.log('🔍 DRY RUN DEMO MODE - Safe to run, will clean up test data');
  }
  
  demo.run().catch(console.error);
}

module.exports = MigrationDemo;