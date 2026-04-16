const mongoose = require('mongoose');
const envConfig = require('../config/envConfig');

// Import models
const DTUser = require('../models/dtUser.model');
const DomainChild = require('../models/domain-child-model');
const { RoleType } = require('../utils/role');

// DOMAIN_OPTIONS from the user's request
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

async function demonstrateMigration() {
  try {
    await mongoose.connect(envConfig.mongo.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n🎯 DOMAIN MIGRATION DEMONSTRATION');
    console.log('='.repeat(60));
    
    // Step 1: Show current state
    console.log('\n📊 CURRENT STATE:');
    const totalUsers = await DTUser.countDocuments();
    const nonAdminUsers = await DTUser.countDocuments({ role: { $ne: RoleType.ADMIN } });
    const usersWithDomains = await DTUser.countDocuments({ 
      'project_preferences.domains_of_interest': { $exists: true, $ne: [] } 
    });
    
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Non-admin users: ${nonAdminUsers}`);
    console.log(`   - Users with domain preferences: ${usersWithDomains}`);
    
    // Step 2: Show existing domain structure
    console.log('\n🏗️  EXISTING DOMAIN STRUCTURE:');
    const existingDomains = await DomainChild.find({ deleted_at: null }).select('name');
    console.log(`   - Total domain children: ${existingDomains.length}`);
    console.log(`   - Sample domains: ${existingDomains.slice(0, 5).map(d => d.name).join(', ')}...`);
    
    // Step 3: Analyze domain mapping with intelligent categorization
    console.log('\n🗺️  DOMAIN MAPPING ANALYSIS:');
    const mappingResults = [];
    
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
    
    for (const domainOption of DOMAIN_OPTIONS) {
      const existingDomain = existingDomains.find(d => 
        d.name.toLowerCase() === domainOption.toLowerCase()
      );
      
      const targetCategory = domainCategoryMapping[domainOption] || 'General';
      
      if (existingDomain) {
        mappingResults.push({
          name: domainOption,
          status: 'EXISTS',
          action: 'Map to existing',
          id: existingDomain._id,
          category: targetCategory
        });
      } else {
        mappingResults.push({
          name: domainOption,
          status: 'MISSING',
          action: 'Create new domain',
          id: null,
          category: targetCategory
        });
      }
    }
    
    const existingCount = mappingResults.filter(r => r.status === 'EXISTS').length;
    const missingCount = mappingResults.filter(r => r.status === 'MISSING').length;
    
    console.log(`   - Domains that exist: ${existingCount}/${DOMAIN_OPTIONS.length}`);
    console.log(`   - Domains to create: ${missingCount}/${DOMAIN_OPTIONS.length}`);
    
    // Group domains by category for display
    const categoryGroups = {};
    const domainsToCreate = mappingResults.filter(r => r.status === 'MISSING');
    domainsToCreate.forEach(domain => {
      if (!categoryGroups[domain.category]) {
        categoryGroups[domain.category] = [];
      }
      categoryGroups[domain.category].push(domain);
    });
    
    // Step 4: Show existing domains with categories
    console.log('\n✅ EXISTING DOMAINS (will reuse):');
    mappingResults.filter(r => r.status === 'EXISTS').forEach(domain => {
      console.log(`   ✅ "${domain.name}" -> ${domain.id} (${domain.category})`);
    });
    
    // Step 5: Show domains to create by category
    console.log('\n🆕 DOMAINS TO CREATE:');
    
    Object.entries(categoryGroups).forEach(([categoryName, domains]) => {
      console.log(`   📁 ${categoryName} (${domains.length} domains):`);
      domains.forEach(domain => {
        console.log(`      🆕 "${domain.name}"`);
      });
    });
    
    // Step 6: Create sample test users
    console.log('\n🧪 CREATING SAMPLE TEST USERS:');
    const testUsers = [
      { 
        fullName: "Test User 1", 
        email: "test1@migration.demo",
        domains: ["Technology", "Science", "Coding"] 
      },
      { 
        fullName: "Test User 2", 
        email: "test2@migration.demo",
        domains: ["Arts and Entertainment", "Education"] 
      },
      { 
        fullName: "Test User 3", 
        email: "test3@migration.demo",
        domains: ["Finance", "Math", "STEM"] 
      }
    ];
    
    const createdTestUsers = [];
    for (const userTemplate of testUsers) {
      // Check if user exists
      let user = await DTUser.findOne({ email: userTemplate.email });
      
      if (!user) {
        user = new DTUser({
          fullName: userTemplate.fullName,
          email: userTemplate.email,
          phone: "1234567890",
          role: RoleType.USER,
          consent: true,
          project_preferences: {
            domains_of_interest: userTemplate.domains
          }
        });
        await user.save();
        console.log(`   ✅ Created: ${userTemplate.fullName} with domains: [${userTemplate.domains.join(', ')}]`);
      } else {
        user.project_preferences.domains_of_interest = userTemplate.domains;
        await user.save();
        console.log(`   ♻️  Updated: ${userTemplate.fullName} with domains: [${userTemplate.domains.join(', ')}]`);
      }
      createdTestUsers.push(user._id);
    }
    
    // Step 7: Show migration impact
    console.log('\n📈 MIGRATION IMPACT:');
    const usersWithDomainsAfter = await DTUser.countDocuments({ 
      'project_preferences.domains_of_interest': { $exists: true, $ne: [] } 
    });
    console.log(`   - Users now have domain preferences: ${usersWithDomainsAfter}`);
    console.log(`   - Expected domain-to-user mappings to create: ${testUsers.reduce((sum, user) => sum + user.domains.length, 0)}`);
    
    // Step 8: Show what the migration would do
    console.log('\n🔄 MIGRATION PREVIEW:');
    console.log('   The migration would:');
    console.log(`   1. Create ${missingCount} new domain children across appropriate categories`);
    console.log(`   2. Intelligently categorize domains (Computing, Arts, Science, etc.)`);
    console.log(`   3. Map ${usersWithDomainsAfter} users to their selected domains`);
    console.log(`   4. Create domain-to-user relationship records`);
    console.log(`   5. Preserve original domains_of_interest data`);
    
    console.log('\n📊 Category Distribution:');
    if (Object.keys(categoryGroups).length > 0) {
      Object.entries(categoryGroups).forEach(([categoryName, domains]) => {
        console.log(`   📁 ${categoryName}: ${domains.length} new domains`);
      });
    } else {
      console.log('   📁 No new domains to create - all exist');
    }
    
    // Step 9: Show next steps
    console.log('\n🚀 NEXT STEPS:');
    console.log('   To run the actual migration:');
    console.log('   1. Review this preview carefully');
    console.log('   2. Run: npm run domain:migrate (dry run)');
    console.log('   3. Run: npm run domain:migrate-live (actual migration)');
    
    // Cleanup test users
    console.log('\n🧹 CLEANING UP TEST DATA:');
    const deleteResult = await DTUser.deleteMany({ _id: { $in: createdTestUsers } });
    console.log(`   ✅ Deleted ${deleteResult.deletedCount} test users`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration demonstration completed successfully!');
    
  } catch (error) {
    console.error('❌ Demonstration failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔐 MongoDB connection closed');
  }
}

// Run the demonstration
demonstrateMigration().catch(console.error);