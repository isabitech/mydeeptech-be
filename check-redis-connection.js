const { redisHealthCheck, getRedisClient } = require('./config/redis.js');
const { getStorageStats } = require('./utils/adminVerificationStore.js');

const checkRedisConnection = async () => {
    console.log('🔍 Checking Redis Connection Status...\n');

    try {
        // Check Redis health
        const health = await redisHealthCheck();
        console.log('📊 Redis Health Check:');
        console.log('  Status:', health.status);
        console.log('  Message:', health.message || 'OK');
        if (health.latency) console.log('  Latency:', health.latency);
        if (health.config) {
            console.log('  Host:', health.config.host);
            console.log('  Port:', health.config.port);
            console.log('  DB:', health.config.db);
        }
        
        // Check client directly
        const client = getRedisClient();
        console.log('\n🔌 Direct Client Check:');
        console.log('  Client exists:', !!client);
        
        if (client) {
            try {
                const pong = await client.ping();
                console.log('  Ping test:', pong);
            } catch (pingError) {
                console.log('  Ping test failed:', pingError.message);
            }
        }
        
        // Check storage stats
        const stats = await getStorageStats();
        console.log('\n📊 Storage Stats:');
        console.log('  Type:', stats.type);
        console.log('  Active Verifications:', stats.activeVerifications);
        
        if (stats.error) {
            console.log('  Error:', stats.error);
        }

    } catch (error) {
        console.error('❌ Error during connection check:', error.message);
    }
};

checkRedisConnection().then(() => process.exit(0));
