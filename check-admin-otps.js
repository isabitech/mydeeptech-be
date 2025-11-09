const { getAllPending, getStorageStats } = require('./utils/adminVerificationStore.js');

const checkRedisOTPs = async () => {
    console.log('🔍 Checking stored Admin OTP verification codes...\n');

    try {
        // Get storage statistics
        const stats = await getStorageStats();
        console.log('📊 Storage Info:');
        console.log('  Type:', stats.type);
        console.log('  Active Verifications:', stats.activeVerifications);
        console.log('  Expiry Time:', stats.expiry);
        console.log('');

        // Get all pending verifications
        const pending = await getAllPending();
        
        if (pending.length === 0) {
            console.log('❌ No pending admin verifications found');
        } else {
            console.log(`✅ Found ${pending.length} pending admin verification(s):\n`);
            
            pending.forEach(([email, data], index) => {
                console.log(`${index + 1}. Email: ${email}`);
                console.log(`   OTP Code: ${data.code}`);
                console.log(`   Admin Name: ${data.adminData?.fullName || 'Unknown'}`);
                console.log(`   Attempts: ${data.attempts}`);
                console.log(`   TTL: ${data.ttl}s remaining`);
                console.log(`   Created: ${new Date(data.createdAt).toISOString()}`);
                console.log(`   Expires: ${new Date(data.expiresAt).toISOString()}`);
                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ Error checking admin verification codes:', error.message);
    }
};

checkRedisOTPs().then(() => process.exit(0));