/**
 * Database Fix Script
 * Removes problematic unique index on cloudinaryData.publicId
 * 
 * Run this once to fix the duplicate key error issue
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📊 Connected to MongoDB');
    
    // Get the VideoReel collection
    const collection = mongoose.connection.db.collection('videoreels');
    
    // Check existing indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Try to drop the problematic index
    try {
      await collection.dropIndex('cloudinaryData.publicId_1');
      console.log('\n✅ Successfully dropped cloudinaryData.publicId_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('\n⚠️  Index cloudinaryData.publicId_1 does not exist (already dropped or never existed)');
      } else {
        console.log('\n❌ Error dropping index:', error.message);
      }
    }
    
    // Check indexes after cleanup
    console.log('\n📋 Indexes after cleanup:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\n🎉 Database fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Disconnected from MongoDB');
  }
}

// Run the fix
fixDatabase().then(() => {
  console.log('🔧 Fix script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fix script failed:', error);
  process.exit(1);
});