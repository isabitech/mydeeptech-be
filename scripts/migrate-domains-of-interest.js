const mongoose = require('mongoose');
const envConfig = require('../config/envConfig');

// Import models
const DTUser = require('../models/dtUser.model');
const DomainCategory = require('../models/domain-category-model');
const DomainSubCategory = require('../models/domain-sub-category-model');
const DomainChild = require('../models/domain-child-model');
const DomainToUser = require('../models/domain-to-user-model');
const { RoleType } = require('../utils/role');

// Previous domain options from frontend
const DOMAIN_OPTIONS = [
  "Arts and Entertainment",
  "Computing",
  "Consumer Electronics",
  "Coding",
  "Code Execution",
  "Code Interpreter",
  "Economy",
  "Education",
  "Employment",
  "Entertainment",
  "Environment",
  "Food and Drink",
  "Health",
  "History",
  "Home & Garden",
  "Information Technology",
  "Law / Legal",
  "Science",
  "Sports",
  "Technology",
  "Travel",
  "Other",
  "Adversarial Prompting",
  "Aspirational Capability",
  "STEM",
  "Finance",
  "Math",
  "Retrieval Augmented Generation (RAG)",
  "News",
  "Coding - Tool Use",
];

class DomainMigration {
  constructor() {
    this.dryRun = true; // Set to false to actually perform migration
    this.migrationResults = {
      usersAffected: [],
      domainsCreated: [],
      mappingsCreated: [],
      errors: []
    };
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

  async fetchExistingDomains() {
    console.log('\n📋 Fetching existing domains...');
    
    const domainCategories = await DomainCategory.find({ deleted_at: null });
    const domainSubCategories = await DomainSubCategory.find({ deleted_at: null });
    const domainChildren = await DomainChild.find({ deleted_at: null }).populate('domain_category domain_sub_category');
    
    console.log(`   - Categories: ${domainCategories.length}`);
    console.log(`   - Sub-categories: ${domainSubCategories.length}`);
    console.log(`   - Domain children: ${domainChildren.length}`);
    
    return { domainCategories, domainSubCategories, domainChildren };
  }

  async cleanupTestUsers() {
    console.log('\n🧹 Cleaning up test users...');
    
    const testUsers = await DTUser.find({
      $or: [
        { fullName: /Migration Test/i },
        { email: /test@example\.com/ },
        { 
          fullName: { $in: ['Alice Johnson (Migration Test)', 'Bob Smith (Migration Test)', 'Carol Davis (Migration Test)'] }
        }
      ]
    });

    if (testUsers.length === 0) {
      console.log('   ✅ No test users found to clean up');
      return;
    }

    console.log(`   Found ${testUsers.length} test users to remove:`);
    testUsers.forEach(user => {
      console.log(`   🗑️ ${user.fullName} (${user.email})`);
    });

    if (!this.dryRun) {
      // Remove domain-to-user relationships for test users
      const testUserIds = testUsers.map(u => u._id);
      await DomainToUser.deleteMany({ user: { $in: testUserIds } });
      
      // Remove test users
      await DTUser.deleteMany({ _id: { $in: testUserIds } });
      console.log(`   ✅ Removed ${testUsers.length} test users and their domain relationships`);
    } else {
      console.log('   🔍 DRY RUN: Would remove test users');
    }
  }

  async findAffectedUsers() {
    console.log('\n👥 Finding affected users...');
    
    // First, get already migrated user IDs to exclude them
    const migratedUserIds = await DomainToUser.distinct('user');
    console.log(`   📊 Already migrated users: ${migratedUserIds.length}`);
    
    // Find non-admin users with domain preferences who haven't been migrated yet
    const users = await DTUser.find({
      role: { $ne: RoleType.ADMIN },
      _id: { $nin: migratedUserIds }, // Exclude already migrated users
      $or: [
        { 'project_preferences.domains_of_interest': { $exists: true, $not: { $size: 0 } } },
        { 'domains': { $exists: true, $not: { $size: 0 } } }
      ],
      // Exclude test users
      fullName: { $not: /Migration Test/i },
      email: { $not: /test@example\.com/ }
    }).select('fullName email role project_preferences.domains_of_interest domains');
    
    console.log(`   Found ${users.length} users with domain preferences (excluding admins and already migrated)`);
    
    // Display user details
    users.forEach((user, index) => {
      const domainsOfInterest = user.project_preferences?.domains_of_interest || [];
      const legacyDomains = user.domains || [];
      
      // Handle different domain formats (strings vs objects)
      const processedLegacyDomains = legacyDomains.map(domain => {
        if (typeof domain === 'object' && domain.name) {
          return domain.name;
        } else if (typeof domain === 'string') {
          return domain;
        }
        return null;
      }).filter(Boolean);
      
      const allDomains = [...new Set([...domainsOfInterest, ...processedLegacyDomains])]; // Combine and dedupe
      
      console.log(`   ${index + 1}. ${user.fullName} (${user.email}) - Role: ${user.role}`);
      if (domainsOfInterest.length > 0) {
        console.log(`      Domains of Interest: ${domainsOfInterest.join(', ')}`);
      }
      if (processedLegacyDomains.length > 0) {
        console.log(`      Legacy Domains: ${processedLegacyDomains.join(', ')}`);
      }
      console.log(`      Combined: ${allDomains.join(', ')}`);
    });
    
    return users;
  }

  async mapDomainOptionsToChildren(existingDomains) {
    console.log('\n🗺️  Mapping domain options to domain children...');
    
    const mapping = [];
    const domainsToCreate = [];
    
    // Define mapping from legacy domains to existing categories
    const domainCategoryMapping = {
      // Computing & Software Engineering
      'Computing': 'Computing & Software Engineering',
      'Coding': 'Computing & Software Engineering', 
      'Code Execution': 'Computing & Software Engineering',
      'Code Interpreter': 'Computing & Software Engineering',
      'Information Technology': 'Computing & Software Engineering',
      'Technology': 'Computing & Software Engineering',
      'Adversarial Prompting': 'Computing & Software Engineering',
      'Coding - Tool Use': 'Computing & Software Engineering',
      'Retrieval Augmented Generation (RAG)': 'Computing & Software Engineering',
      'Aspirational Capability': 'Computing & Software Engineering',
      
      // Arts, Media & Entertainment
      'Arts and Entertainment': 'Arts, Media & Entertainment',
      'Entertainment': 'Arts, Media & Entertainment',
      
      // Engineering & Applied Sciences  
      'Consumer Electronics': 'Engineering & Applied Sciences',
      
      // Mathematics & Formal Sciences
      'Math': 'Mathematics & Formal Sciences',
      'STEM': 'Mathematics & Formal Sciences',
      
      // Natural Sciences
      'Science': 'Natural Sciences',
      'Environment': 'Natural Sciences',
      
      // Business, Economics & Finance
      'Economy': 'Business, Economics & Finance',
      'Finance': 'Business, Economics & Finance',
      'Employment': 'Business, Economics & Finance',
      
      // Education & Academia
      'Education': 'Education & Academia',
      
      // Law, Governance & Public Policy
      'Law / Legal': 'Law, Governance & Public Policy',
      
      // Social Sciences & Humanities
      'Sports': 'Social Sciences & Humanities',
      'News': 'Social Sciences & Humanities',
      'History': 'Social Sciences & Humanities',
      
      // Medicine & Healthcare
      'Health': 'Medicine & Healthcare',
      
      // Industry-Specific Domains
      'Food and Drink': 'Industry-Specific Domains',
      'Home & Garden': 'Industry-Specific Domains',
      'Travel': 'Industry-Specific Domains',
      'Other': 'Industry-Specific Domains',
    };
    
    // Create a general category for unmapped domains if needed
    let generalCategory = existingDomains.domainCategories.find(cat => 
      cat.name.toLowerCase() === 'general' || cat.name.toLowerCase() === 'migrated'
    );
    
    if (!generalCategory && !this.dryRun) {
      generalCategory = new DomainCategory({
        name: 'General',
        description: 'General domain categories migrated from legacy system'
      });
      await generalCategory.save();
      console.log(`   ✅ Created general category: ${generalCategory.name}`);
      this.migrationResults.domainsCreated.push({
        type: 'category',
        name: generalCategory.name,
        id: generalCategory._id
      });
    }
    
    for (const domainOption of DOMAIN_OPTIONS) {
      // Check if domain child already exists (case-insensitive)
      let existingChild = existingDomains.domainChildren.find(child => 
        child.name.toLowerCase() === domainOption.toLowerCase()
      );
      
      if (existingChild) {
        mapping.push({
          originalName: domainOption,
          domainChild: existingChild,
          action: 'existing',
          categoryName: existingChild.domain_category?.name || 'Unknown'
        });
        console.log(`   ✅ Found existing: "${domainOption}" -> ${existingChild._id}`);
      } else {
        // Determine the appropriate category for this domain
        const targetCategoryName = domainCategoryMapping[domainOption];
        let targetCategory = null;
        
        if (targetCategoryName) {
          // Find the target category in existing categories
          targetCategory = existingDomains.domainCategories.find(cat => 
            cat.name.toLowerCase() === targetCategoryName.toLowerCase()
          );
          
          if (targetCategory) {
            console.log(`   🎯 Will create "${domainOption}" in category: ${targetCategoryName}`);
          } else {
            console.log(`   ⚠️  Category "${targetCategoryName}" not found, using General`);
            targetCategory = generalCategory;
          }
        } else {
          console.log(`   📦 No specific category mapping for "${domainOption}", using General`);
          targetCategory = generalCategory;
        }
        
        // Need to create new domain child
        const newChild = {
          name: domainOption,
          domain_category: targetCategory ? targetCategory._id : null,
          description: `Migrated from legacy domains_of_interest field`
        };
        
        domainsToCreate.push(newChild);
        mapping.push({
          originalName: domainOption,
          domainChild: newChild,
          action: 'create',
          categoryName: targetCategory?.name || 'General',
          categoryId: targetCategory?._id
        });
      }
    }
    
    // Show categorization summary
    console.log('\n📊 Categorization Summary:');
    const categoryGroups = {};
    mapping.forEach(m => {
      const categoryName = m.categoryName || 'Unknown';
      if (!categoryGroups[categoryName]) {
        categoryGroups[categoryName] = [];
      }
      categoryGroups[categoryName].push(m);
    });
    
    Object.entries(categoryGroups).forEach(([categoryName, domains]) => {
      console.log(`   📁 ${categoryName}: ${domains.length} domains`);
      domains.forEach(domain => {
        const icon = domain.action === 'existing' ? '✅' : '🆕';
        console.log(`      ${icon} ${domain.originalName}`);
      });
    });
    
    return { mapping, domainsToCreate, generalCategory };
  }

  async createMissingDomains(domainsToCreate) {
    if (domainsToCreate.length === 0) {
      console.log('\n✅ No new domains need to be created');
      return [];
    }
    
    console.log(`\n🛠️  Creating ${domainsToCreate.length} missing domains...`);
    const createdDomains = [];
    
    if (!this.dryRun) {
      for (const domainData of domainsToCreate) {
        try {
          const domainChild = new DomainChild(domainData);
          await domainChild.save();
          createdDomains.push(domainChild);
          console.log(`   ✅ Created: "${domainChild.name}" (${domainChild._id})`);
          
          this.migrationResults.domainsCreated.push({
            type: 'child',
            name: domainChild.name,
            id: domainChild._id
          });
        } catch (error) {
          console.error(`   ❌ Error creating domain "${domainData.name}":`, error.message);
          this.migrationResults.errors.push({
            type: 'domain_creation',
            domain: domainData.name,
            error: error.message
          });
        }
      }
    } else {
      console.log('   🔍 DRY RUN: Would create the above domains');
    }
    
    return createdDomains;
  }

  async showMigrationPreview(users, mapping, generalCategory) {
    console.log('\n📊 MIGRATION PREVIEW');
    console.log('='.repeat(50));
    
    console.log(`\n📈 Summary:`);
    console.log(`   - Users to migrate: ${users.length}`);
    console.log(`   - Domain mappings: ${mapping.length}`);
    console.log(`   - New domains to create: ${mapping.filter(m => m.action === 'create').length}`);
    console.log(`   - Existing domains to use: ${mapping.filter(m => m.action === 'existing').length}`);
    
    if (generalCategory) {
      console.log(`   - General category: ${generalCategory.name} (${generalCategory._id})`);
    }
    
    console.log(`\n👤 Users and their domain mappings:`);
    users.forEach((user, index) => {
      const domainsOfInterest = user.project_preferences?.domains_of_interest || [];
      const legacyDomains = user.domains || [];
      
      // Process legacy domains to extract domain names (handle both string and object formats)
      const processedLegacyDomains = legacyDomains.map(domain => {
        if (typeof domain === 'object' && domain.name) {
          return domain.name;
        } else if (typeof domain === 'string') {
          return domain;
        }
        return null;
      }).filter(Boolean);
      
      const allDomains = [...new Set([...domainsOfInterest, ...processedLegacyDomains])]; // Combine and dedupe
      
      console.log(`\n   ${index + 1}. ${user.fullName} (${user.email})`);
      if (domainsOfInterest.length > 0) {
        console.log(`      Domains of Interest: ${domainsOfInterest.join(', ')}`);
      }
      if (processedLegacyDomains.length > 0) {
        console.log(`      Legacy Domains: ${processedLegacyDomains.join(', ')}`);
      }
      console.log(`      Combined domains (${allDomains.length}): ${allDomains.join(', ')}`);
      
      const userMappings = allDomains
        .map(domain => mapping.find(m => m.originalName === domain))
        .filter(Boolean);
        
      console.log(`      Will be mapped to:`);
      userMappings.forEach(m => {
        const childId = m.domainChild._id || '[NEW]';
        const action = m.action === 'existing' ? '✅' : '🆕';
        const category = m.categoryName ? ` (${m.categoryName})` : '';
        console.log(`        ${action} "${m.originalName}" -> ${childId}${category}`);
      });
    });
    
    console.log('\n' + '='.repeat(50));
  }

  async performMigration(users, mapping, createdDomains) {
    if (this.dryRun) {
      console.log('\n🔍 DRY RUN MODE - No actual migration performed');
      return;
    }
    
    console.log('\n🚀 Performing migration...');
    
    // Update mapping with created domains
    const updatedMapping = mapping.map(m => {
      if (m.action === 'create') {
        const createdDomain = createdDomains.find(d => d.name === m.originalName);
        return { ...m, domainChild: createdDomain };
      }
      return m;
    });
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        console.log(`   Processing user: ${user.fullName}...`);
        
        // Get all domain preferences from both sources
        const domainsOfInterest = user.project_preferences?.domains_of_interest || [];
        const legacyDomains = user.domains || [];
        
        // Process legacy domains to extract domain names (handle both string and object formats)
        const processedLegacyDomains = legacyDomains.map(domain => {
          if (typeof domain === 'object' && domain.name) {
            return domain.name;
          } else if (typeof domain === 'string') {
            return domain;
          }
          return null;
        }).filter(Boolean);
        
        const allDomains = [...new Set([...domainsOfInterest, ...processedLegacyDomains])]; // Combine and dedupe
        
        console.log(`     Processing ${allDomains.length} domains: ${allDomains.join(', ')}`);
        
        // Create domain-to-user mappings for all domains
        for (const domainName of allDomains) {
          const mappingEntry = updatedMapping.find(m => m.originalName === domainName);
          
          if (!mappingEntry || !mappingEntry.domainChild) {
            console.warn(`     ⚠️  No mapping found for domain: ${domainName}`);
            continue;
          }
          
          // Check if mapping already exists
          const existingMapping = await DomainToUser.findOne({
            user: user._id,
            domain_child: mappingEntry.domainChild._id
          });
          
          if (existingMapping) {
            console.log(`     ℹ️  Mapping already exists for domain: ${domainName}`);
            continue;
          }
          
          // Create new mapping
          const domainToUser = new DomainToUser({
            domain_category: mappingEntry.domainChild.domain_category,
            domain_child: mappingEntry.domainChild._id,
            domain_sub_category: mappingEntry.domainChild.domain_sub_category || null,
            user: user._id
          });
          
          await domainToUser.save();
          console.log(`     ✅ Created mapping: ${domainName} -> ${mappingEntry.domainChild._id}`);
          
          this.migrationResults.mappingsCreated.push({
            userId: user._id,
            userName: user.fullName,
            domainName: domainName,
            domainChildId: mappingEntry.domainChild._id
          });
        }
        
        // Optional: Clear the old domain fields after successful migration
        // await DTUser.findByIdAndUpdate(user._id, {
        //   $unset: { 
        //     'project_preferences.domains_of_interest': '',
        //     'domains': ''
        //   }
        // });
        
        successCount++;
        console.log(`   ✅ Successfully migrated user: ${user.fullName}`);
        this.migrationResults.usersAffected.push({
          userId: user._id,
          userName: user.fullName,
          email: user.email,
          domainsCount: allDomains.length
        });
        
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error migrating user ${user.fullName}:`, error.message);
        this.migrationResults.errors.push({
          type: 'user_migration',
          userId: user._id,
          userName: user.fullName,
          error: error.message
        });
      }
    }
    
    console.log(`\n📊 Migration completed: ${successCount} success, ${errorCount} errors`);
  }

  async generateReport() {
    console.log('\n📄 MIGRATION REPORT');
    console.log('='.repeat(50));
    
    const results = this.migrationResults;
    
    console.log(`📈 Summary:`);
    console.log(`   - Users migrated: ${results.usersAffected.length}`);
    console.log(`   - Domains created: ${results.domainsCreated.length}`);
    console.log(`   - Mappings created: ${results.mappingsCreated.length}`);
    console.log(`   - Errors encountered: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.type}: ${error.error}`);
      });
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    if (this.dryRun) {
      console.log('\n⚠️  This was a DRY RUN. Set dryRun = false to perform actual migration.');
    }
  }

  async run() {
    try {
      await this.connectDB();
      
      console.log('🚀 Starting Domain Migration Process');
      console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
      
      // Step 0: Clean up test users first
      await this.cleanupTestUsers();
      
      // Step 1: Fetch existing domains
      const existingDomains = await this.fetchExistingDomains();
      
      // Step 2: Find affected users (real users with domain preferences)
      const affectedUsers = await this.findAffectedUsers();
      
      if (affectedUsers.length === 0) {
        console.log('\n✅ No users found with domain preferences to migrate');
        return;
      }
      
      // Step 3: Map domain options to domain children
      const { mapping, domainsToCreate, generalCategory } = await this.mapDomainOptionsToChildren(existingDomains);
      
      // Step 4: Show preview
      await this.showMigrationPreview(affectedUsers, mapping, generalCategory);
      
      // Prompt for confirmation if not dry run
      if (!this.dryRun) {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          rl.question('\nDo you want to proceed with the migration? (yes/no): ', resolve);
        });
        rl.close();
        
        if (answer.toLowerCase() !== 'yes') {
          console.log('Migration cancelled.');
          return;
        }
      }
      
      // Step 5: Create missing domains
      const createdDomains = await this.createMissingDomains(domainsToCreate);
      
      // Step 6: Perform migration
      await this.performMigration(affectedUsers, mapping, createdDomains);
      
      // Step 7: Generate report
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
    } finally {
      await this.disconnectDB();
    }
  }
}

// Script execution
if (require.main === module) {
  const migration = new DomainMigration();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--live')) {
    migration.dryRun = false;
    console.log('⚠️  LIVE MIGRATION MODE ENABLED');
  }
  
  migration.run().catch(console.error);
}

module.exports = DomainMigration;