require('dotenv').config();
const { cloudinary } = require('./config/cloudinary');

// Simple test to check if Cloudinary works
async function simpleCloudinaryTest() {
  console.log('🧪 Simple Cloudinary Test\n');
  
  try {
    console.log('1. Environment Check:');
    console.log(`   CLOUDINARY_CLOUD_NAME: ${process.env.CLOUDINARY_CLOUD_NAME || 'MISSING'}`);
    console.log(`   CLOUDINARY_API_KEY: ${process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING'}`);
    console.log(`   CLOUDINARY_API_SECRET: ${process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING'}\n`);

    console.log('2. API Test:');
    const pingResult = await cloudinary.api.ping();
    console.log('   ✅ Cloudinary API is responsive');
    console.log(`   Status: ${pingResult.status}\n`);

    console.log('🎉 Cloudinary is properly configured and working!');

  } catch (error) {
    console.error('❌ Cloudinary test failed:', error.message);
    console.error('Full error:', error);
  }
}

simpleCloudinaryTest();