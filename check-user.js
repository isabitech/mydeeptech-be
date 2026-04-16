const mongoose = require('mongoose');
const envConfig = require('./config/envConfig');

async function checkUserData() {
  try {
    await mongoose.connect(envConfig.mongo.MONGO_URI);
    console.log('🔍 Checking specific user data');
    console.log('==============================');
    
    // Find a user with the 'Go' domain ID from the user's example
    const targetDomainId = '69de9bc6813002a5ec8f8d89';
    
    // Check if this domain exists in domain_children
    const domainChild = await mongoose.connection.db.collection('domain_children').findOne({ _id: new mongoose.Types.ObjectId(targetDomainId) });
    if (domainChild) {
      console.log(`✅ Found domain in domain_children: ${domainChild.name}`);
    } else {
      console.log('❌ Domain not found in domain_children');
    }
    
    // Find users who have this domain in their legacy domains field
    const usersWithGoDomain = await mongoose.connection.db.collection('dtusers').find({
      'domains._id': new mongoose.Types.ObjectId(targetDomainId)
    }).toArray();
    
    console.log(`📊 Found ${usersWithGoDomain.length} users with this 'Go' domain in legacy field`);
    
    if (usersWithGoDomain.length > 0) {
      const sampleUser = usersWithGoDomain[0];
      console.log(`👤 Sample user: ${sampleUser.fullname} (${sampleUser.email})`);
      console.log(`📋 Legacy domains: ${JSON.stringify(sampleUser.domains, null, 2)}`);
      
      // Check if this user has migrated domains
      const migratedDomains = await mongoose.connection.db.collection('domaintousers').find({ user: sampleUser._id }).toArray();
      console.log(`🔄 Migrated domains for this user: ${migratedDomains.length}`);
      
      if (migratedDomains.length > 0) {
        console.log('✅ User has migrated domains');
      } else {
        console.log('⚠️ User has NO migrated domains');
      }
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    mongoose.disconnect();
  }
}

checkUserData();