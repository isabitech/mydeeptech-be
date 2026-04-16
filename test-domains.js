const mongoose = require('mongoose');
const envConfig = require('./config/envConfig');
const DomainToUserService = require('./services/domain-to-user.service');

async function testUserDomains() {
  try {
    await mongoose.connect(envConfig.mongo.MONGO_URI);
    console.log('🧪 Testing DomainToUserService');
    console.log('==============================');
    
    // Find a user with domain mappings
    const userWithDomains = await mongoose.connection.db.collection('domaintousers').findOne();
    
    if (!userWithDomains) {
      console.log('❌ No domain mappings found');
      return;
    }
    
    console.log(`📋 Testing with user ID: ${userWithDomains.user}`);
    
    try {
      const domainRelationships = await DomainToUserService.fetchDomainToUserById(userWithDomains.user);
      console.log(`✅ Service returned ${domainRelationships.length} domains`);
      
      if (domainRelationships.length > 0) {
        console.log('🔍 Sample domain structure:');
        console.log(JSON.stringify(domainRelationships[0], null, 2));
        
        // Test the transformation used in login
        const transformed = domainRelationships.map(relation => ({
          _id: relation.domain_child._id,
          name: relation.domain_child.name
        }));
        console.log('\n🔄 Transformed format:');
        console.log(JSON.stringify(transformed.slice(0, 3), null, 2));
      }
      
    } catch (serviceError) {
      console.error('❌ DomainToUserService error:', serviceError.message);
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    mongoose.disconnect();
  }
}

testUserDomains();