import mongoose from 'mongoose';
import url from 'url';
import { server } from './app.js';
import { initRedis, closeRedis } from './config/redis.js';
import envConfig from './config/envConfig.js';

// dotenv.config({ path: './.env' });

// Initialize Redis connection
const initializeRedis = async () => {
    try {
        console.log('🔄 Initializing Redis connection...');
        await initRedis();
        console.log('✅ Redis initialization completed');
    } catch (error) {
        console.log('⚠️ Redis initialization failed, will use fallback storage:', error.message);
    }
};

// Configure mongoose for production
mongoose.set('bufferCommands', false);

// Enhanced MongoDB connection with retry logic
const connectDB = async () => {
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            console.log(`🔄 Attempting MongoDB connection (attempt ${retries + 1}/${maxRetries})...`);

            const conn = await mongoose.connect(envConfig.mongo.MONGO_URI, {
                serverSelectionTimeoutMS: 60000,
                socketTimeoutMS: 60000,
                connectTimeoutMS: 60000,
                maxPoolSize: 10,
                minPoolSize: 2,
                maxIdleTimeMS: 30000,
                heartbeatFrequencyMS: 10000,
            });

            console.log(`✅ MongoDB connected successfully to: ${conn.connection.host}`);
            return conn;
        } catch (error) {
            retries++;
            console.error(`❌ MongoDB connection attempt ${retries} failed:`, error.message);
            if (retries === maxRetries) {
                console.error('💀 All MongoDB connection attempts failed');
                throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts: ${error.message}`);
            }
            const waitTime = Math.pow(2, retries) * 1000;
            console.log(`⏳ Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
    try {
        await closeRedis();
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Start Server only if run directly
if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    connectDB().catch(err => {
        console.error('💀 Fatal: Could not establish MongoDB connection:', err.message);
        process.exit(1);
    });

    initializeRedis();

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    const PORT = envConfig.PORT || 4000;
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`💬 Socket.IO chat server active`);
        console.log(`🔗 Health check available at: http://localhost:${PORT}/health`);
    });
}



