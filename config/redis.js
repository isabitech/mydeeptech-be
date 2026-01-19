import redis from 'redis';

// Global variables for Redis client
let redisClient = null;
let isRedisConnectedValue = false;
let redisConnectionAttempts = 0;
const maxRetries = 1;

// Parse Redis host and port from environment
const parseRedisConfig = () => {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;

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
        const { host, port } = parseRedisConfig();
        const redisConfig = {
            host: host,
            port: port,
            password: process.env.REDIS_PASSWORD || null,
            db: parseInt(process.env.REDIS_DB) || 0,
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
                reconnectStrategy: () => false
            },
            password: redisConfig.password,
            database: redisConfig.db,
            retryDelayOnFailover: redisConfig.retryDelayOnFailover,
            enableOfflineQueue: redisConfig.enableOfflineQueue
        });

        redisClient.on('connect', () => {
            console.log('🟢 Redis client connected');
        });

        redisClient.on('ready', () => {
            console.log('✅ Redis client ready to use');
            isRedisConnectedValue = true;
            redisConnectionAttempts = 0;
        });

        redisClient.on('error', (err) => {
            console.error('❌ Redis client error:', err.code || err.message);
            isRedisConnectedValue = false;
        });

        redisClient.on('end', () => {
            console.log('🔌 Redis client disconnected');
            isRedisConnectedValue = false;
        });

        const connectPromise = redisClient.connect();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Redis connection timeout')), redisConfig.connectTimeout);
        });

        await Promise.race([connectPromise, timeoutPromise]);

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
        isRedisConnectedValue = false;

        if (redisClient) {
            try {
                await redisClient.quit();
            } catch (quitError) { }
            redisClient = null;
        }

        console.log('⚠️ Falling back to in-memory storage');
        return null;
    }
};

const initRedis = async () => {
    try {
        return await createRedisClient();
    } catch (error) {
        console.error('❌ Failed to initialize Redis:', error.message);
        return null;
    }
};

const getRedisClient = () => {
    if (!isRedisConnectedValue || !redisClient) {
        return null;
    }
    return redisClient;
};

const closeRedis = async () => {
    if (redisClient) {
        try {
            console.log('🔄 Closing Redis connection...');
            if (isRedisConnectedValue) {
                await redisClient.quit();
            } else {
                await redisClient.disconnect();
            }
            console.log('✅ Redis connection closed gracefully');
        } catch (error) {
            console.error('❌ Error closing Redis connection:', error.message);
        } finally {
            redisClient = null;
            isRedisConnectedValue = false;
        }
    }
};

const redisHealthCheck = async () => {
    try {
        if (!redisClient || !isRedisConnectedValue) {
            return { status: 'disconnected', message: 'Redis client not connected' };
        }

        const start = Date.now();
        await redisClient.ping();
        const latency = Date.now() - start;

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

const isRedisConnected = () => isRedisConnectedValue;

export {
    initRedis,
    getRedisClient,
    closeRedis,
    redisHealthCheck,
    isRedisConnected
};
