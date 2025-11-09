const redis = require('redis');

// Global variables for Redis client
let redisClient = null;
let isRedisConnected = false;
let redisConnectionAttempts = 0;
const maxRetries = 1;

// Parse Redis host and port from environment
const parseRedisConfig = () => {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;
    
    // Debug: Log what we're reading from environment
    console.log('🔍 Environment variables:');
    console.log(`   REDIS_HOST: ${process.env.REDIS_HOST}`);
    console.log(`   REDIS_PORT: ${process.env.REDIS_PORT}`);
    console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '[HIDDEN]' : 'Not set'}`);
    console.log(`   REDIS_DB: ${process.env.REDIS_DB}`);
    
    // Check if host includes port (for Redis Cloud URLs like "host:port")
    if (redisHost.includes(':') && !redisHost.startsWith('redis://')) {
        const [host, port] = redisHost.split(':');
        return {
            host: host,
            port: parseInt(port) || redisPort
        };
    }
    
    return {
        host: redisHost,
        port: parseInt(redisPort)
    };
};

const createRedisClient = async () => {
    try {
        // Parse configuration at connection time (not at module load time)
        const { host, port } = parseRedisConfig();
        const redisConfig = {
            host: host,
            port: port,
            password: process.env.REDIS_PASSWORD || null,
            db: parseInt(process.env.REDIS_DB) || 0, // Parse as integer, ignore non-numeric values
            retryDelayOnFailover: 100,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            connectTimeout: 5000,
            commandTimeout: 3000
        };

        console.log('🔄 Attempting to connect to Redis...');
        console.log(`📍 Redis Config: ${redisConfig.host}:${redisConfig.port}, DB: ${redisConfig.db}`);
        
        redisClient = redis.createClient({
            socket: {
                host: redisConfig.host,
                port: redisConfig.port,
                connectTimeout: redisConfig.connectTimeout,
                commandTimeout: redisConfig.commandTimeout,
                reconnectStrategy: () => false // Disable reconnection
            },
            password: redisConfig.password,
            database: redisConfig.db,
            retryDelayOnFailover: redisConfig.retryDelayOnFailover,
            enableOfflineQueue: redisConfig.enableOfflineQueue
        });

        // Event handlers
        redisClient.on('connect', () => {
            console.log('🟢 Redis client connected');
        });

        redisClient.on('ready', () => {
            console.log('✅ Redis client ready to use');
            isRedisConnected = true;
            redisConnectionAttempts = 0;
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis client error:', err.code || err.message);
            isRedisConnected = false;
        });

        redisClient.on('end', () => {
            console.log('🔌 Redis client disconnected');
            isRedisConnected = false;
        });

        // Connect to Redis with timeout
        const connectPromise = redisClient.connect();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Redis connection timeout')), redisConfig.connectTimeout);
        });

        await Promise.race([connectPromise, timeoutPromise]);
        
        // Test connection
        const pong = await redisClient.ping();
        if (pong === 'PONG') {
            console.log('🏓 Redis connection test successful');
            return redisClient;
        } else {
            throw new Error('Redis ping test failed');
        }

    } catch (error) {
        console.error(`❌ Redis connection failed: ${error.message}`);
        redisConnectionAttempts++;
        isRedisConnected = false;

        if (redisClient) {
            try {
                await redisClient.quit();
            } catch (quitError) {
                // Ignore quit errors
            }
            redisClient = null;
        }

        console.log('⚠️ Falling back to in-memory storage');
        return null;
    }
};

// Initialize Redis connection
const initRedis = async () => {
    try {
        return await createRedisClient();
    } catch (error) {
        console.error('❌ Failed to initialize Redis:', error.message);
        return null;
    }
};

// Get Redis client (with fallback check)
const getRedisClient = () => {
    if (!isRedisConnected || !redisClient) {
        return null;
    }
    return redisClient;
};

// Graceful shutdown
const closeRedis = async () => {
    if (redisClient) {
        try {
            console.log('🔄 Closing Redis connection...');
            if (isRedisConnected) {
                await redisClient.quit();
            } else {
                await redisClient.disconnect();
            }
            console.log('✅ Redis connection closed gracefully');
        } catch (error) {
            console.error('❌ Error closing Redis connection:', error.message);
        } finally {
            redisClient = null;
            isRedisConnected = false;
        }
    }
};

// Health check
const redisHealthCheck = async () => {
    try {
        if (!redisClient || !isRedisConnected) {
            return { status: 'disconnected', message: 'Redis client not connected' };
        }
        
        const start = Date.now();
        await redisClient.ping();
        const latency = Date.now() - start;
        
        // Get current config for health check
        const { host, port } = parseRedisConfig();
        
        return { 
            status: 'connected', 
            latency: `${latency}ms`,
            config: {
                host: host,
                port: port,
                db: parseInt(process.env.REDIS_DB) || 0
            }
        };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
};

module.exports = {
    initRedis,
    getRedisClient,
    closeRedis,
    redisHealthCheck,
    isRedisConnected: () => isRedisConnected
};