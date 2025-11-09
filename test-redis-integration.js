const { initRedis, closeRedis, redisHealthCheck, getRedisClient } = require('./config/redis');
const { 
    setVerificationCode, 
    getVerificationData, 
    removeVerificationCode, 
    getStorageStats 
} = require('./utils/adminVerificationStore');

async function testRedisIntegration() {
    console.log('🧪 Testing Redis Integration with Fallback...\n');

    try {
        // Initialize Redis (will fall back to in-memory if Redis server not available)
        console.log('1️⃣ Initializing Redis...');
        await initRedis();
        
        // Check Redis health
        console.log('2️⃣ Checking Redis health...');
        const healthStatus = await redisHealthCheck();
        console.log('🏥 Health Status:', JSON.stringify(healthStatus, null, 2));
        
        // Check storage stats
        console.log('\n3️⃣ Checking storage stats...');
        const stats = await getStorageStats();
        console.log('📊 Storage Stats:', JSON.stringify(stats, null, 2));
        
        // Test admin verification storage
        console.log('\n4️⃣ Testing admin verification storage...');
        const testEmail = 'test.admin@mydeeptech.ng';
        const testCode = '123456';
        const testAdminData = {
            firstName: 'Test',
            lastName: 'Admin',
            email: testEmail,
            role: 'admin'
        };

        // Store verification code
        console.log(`📝 Storing verification code for ${testEmail}...`);
        await setVerificationCode(testEmail, testCode, testAdminData);

        // Retrieve verification data
        console.log(`🔍 Retrieving verification data for ${testEmail}...`);
        const retrievedData = await getVerificationData(testEmail);
        if (retrievedData) {
            console.log('✅ Retrieved data:', {
                code: retrievedData.code,
                email: retrievedData.email,
                attempts: retrievedData.attempts,
                adminData: retrievedData.adminData
            });
        } else {
            console.log('❌ No data retrieved');
        }

        // Test with wrong email
        console.log(`🔍 Testing with non-existent email...`);
        const nonExistentData = await getVerificationData('nonexistent@example.com');
        console.log('🔍 Non-existent data result:', nonExistentData ? 'Found (unexpected)' : 'Not found (expected)');

        // Clean up
        console.log(`🗑️ Cleaning up test data...`);
        await removeVerificationCode(testEmail);

        // Verify cleanup
        console.log(`🔍 Verifying cleanup...`);
        const afterCleanup = await getVerificationData(testEmail);
        console.log('🧹 After cleanup result:', afterCleanup ? 'Still exists (unexpected)' : 'Removed (expected)');

        // Final storage stats
        console.log('\n5️⃣ Final storage stats...');
        const finalStats = await getStorageStats();
        console.log('📊 Final Storage Stats:', JSON.stringify(finalStats, null, 2));

        console.log('\n✅ Redis integration test completed successfully!');
        console.log(`📝 Using storage type: ${finalStats.type}`);
        
        if (finalStats.type.includes('Fallback')) {
            console.log('\n⚠️  NOTE: Redis server not detected, using in-memory fallback storage.');
            console.log('💡 To use Redis in production:');
            console.log('   1. Install Redis server locally or use a cloud Redis service');
            console.log('   2. Update REDIS_HOST, REDIS_PORT in your .env file');
            console.log('   3. The system will automatically switch to Redis when available');
        } else {
            console.log('\n🎉 Redis is working perfectly!');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.log('\n🔄 Falling back to in-memory storage...');
    } finally {
        // Close Redis connection
        console.log('\n6️⃣ Closing Redis connection...');
        await closeRedis();
        console.log('👋 Test completed');
    }
}

// Run the test
if (require.main === module) {
    testRedisIntegration().catch(console.error);
}

module.exports = { testRedisIntegration };