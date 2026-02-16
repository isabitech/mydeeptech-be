const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createServer } = require('http');
const { initializeSocketIO } = require('./utils/chatSocketService');
const { initRedis, closeRedis, redisHealthCheck } = require('./config/redis');
const dns = require('node:dns');

// Conditionally load Swagger (optional dependency)
let swaggerUi, specs;
try {
    const swagger = require('./config/swagger');
    swaggerUi = swagger.swaggerUi;
    specs = swagger.specs;
} catch (error) {
    console.log('⚠️ Swagger dependencies not found. API documentation will not be available.');
    swaggerUi = null;
    specs = null;
}

//console.log("Loaded BREVO_API_KEY:", process.env.BREVO_API_KEY ? "✅ Yes" : "❌ No");

const route = require('./routes/auth');
const adminRoute = require('./routes/admin');
const mediaRoute = require('./routes/media');
const notificationRoute = require('./routes/notifications');
const assessmentRoute = require('./routes/assessment');
const supportRoute = require('./routes/support');
const chatRoute = require('./routes/chat');
const qaRoute = require('./routes/qa');
const envConfig = require('./config/envConfig');
const domain = require('./routes/domains.routes')

const app = express();
const server = createServer(app);

// Initialize Socket.IO for chat functionality
initializeSocketIO(server);

// CORS Configuration - Development and Production
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://mydeeptech.ng',
        // Frontend URLs
        'https://www.mydeeptech.ng',
        'https://mydeeptech.onrender.com',
        'https://mydeeptech-frontend.onrender.com',

        // Backend URLs
        'https://mydeeptech-be.onrender.com',
        'https://mydeeptech-be-lmrk.onrender.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'token']
};

app.get("/", (_req, res) => {
    res.send('Welcome to My Deep Tech');
});

// Enhanced health check endpoint with database ping
app.get("/health", async (req, res) => {
    try {
        const redisStatus = await redisHealthCheck();

        // Test MongoDB connectivity with actual database operation
        let mongoStatus = 'disconnected';
        let mongoDetails = { status: 'disconnected' };

        if (mongoose.connection.readyState === 1) {
            try {
                // Perform actual database ping
                await mongoose.connection.db.admin().ping();
                const collections = await mongoose.connection.db.listCollections().toArray();

                mongoStatus = 'connected';
                mongoDetails = {
                    status: 'connected',
                    host: mongoose.connection.host,
                    database: mongoose.connection.name,
                    collections: collections.length,
                    readyState: mongoose.connection.readyState
                };
            } catch (dbError) {
                mongoStatus = 'error';
                mongoDetails = {
                    status: 'error',
                    error: dbError.message,
                    readyState: mongoose.connection.readyState
                };
            }
        }

        const isHealthy = mongoStatus === 'connected' && redisStatus.status === 'connected';

        res.status(isHealthy ? 200 : 503).json({
            status: isHealthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                mongodb: mongoDetails,
                redis: redisStatus
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Global JSON parsing error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('❌ JSON Syntax Error:', err.message);
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON payload. Please check your syntax (ensure double quotes are used and no trailing commas).',
            error: err.message
        });
    }
    next(err);
});

// API Documentation (only if Swagger is available)
if (swaggerUi && specs) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
        explorer: true,
        customSiteTitle: "MyDeepTech API Documentation",
        customfavIcon: "/favicon.ico",
        customCss: '.swagger-ui .topbar { display: none }'
    }));
    console.log('📚 API Documentation available at: http://localhost:5000/api-docs');
} else {
    console.log('📚 API Documentation not available (Swagger dependencies missing)');
}

// Routes
app.use('/api/auth', route);
app.use('/api/admin', adminRoute);
app.use('/api/media', mediaRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/assessments', assessmentRoute);
app.use('/api/support', supportRoute);
app.use('/api/chat', chatRoute);
app.use('/api/qa', qaRoute);
app.use('/api/domains', domain);

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
mongoose.set('bufferCommands', false); // Disable mongoose buffering for production

// Enhanced MongoDB connection with retry logic and production timeouts
const connectDB = async () => {
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            console.log(`🔄 Attempting MongoDB connection (attempt ${retries + 1}/${maxRetries})...`);
            // Perform actual database ping
            if (envConfig.NODE_ENV === 'development') {
                const dns = require('node:dns');
                dns.setServers(['8.8.8.8', '8.8.4.4']);
            }
            const conn = await mongoose.connect(envConfig.mongo.MONGO_URI, {
                // Production-optimized timeouts
                serverSelectionTimeoutMS: 60000, // 60 seconds
                socketTimeoutMS: 60000,          // 60 seconds  
                connectTimeoutMS: 60000,         // 60 seconds
                maxPoolSize: 10,                // Connection pool size
                minPoolSize: 2,                 // Minimum connections
                maxIdleTimeMS: 30000,           // Close connections after 30s idle
                heartbeatFrequencyMS: 10000,    // Heartbeat every 10s
            });

            console.log(`✅ MongoDB connected successfully to: ${conn.connection.host}`);

            // Test database connectivity
            const collections = await mongoose.connection.db.listCollections().toArray();
            console.log(`📊 Database verification: Found ${collections.length} collections`);

            return conn;
        } catch (error) {
            console.log(`❌ MongoDB connection attempt  failed:`, error);
            console.log(envConfig.NODE_ENV);
            retries++;
            console.error(`❌ MongoDB connection attempt ${retries} failed:`, error.message);

            if (retries === maxRetries) {
                console.error('💀 All MongoDB connection attempts failed');
                throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts: ${error.message}`);
            }

            // Exponential backoff: wait 2^retries seconds before retry
            const waitTime = Math.pow(2, retries) * 1000;
            console.log(`⏳ Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

// Database Connection
connectDB().catch(err => {
    console.error('💀 Fatal: Could not establish MongoDB connection:', err.message);
    process.exit(1);
});

// Initialize Redis (non-blocking)
initializeRedis();

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

    try {
        // Close Redis connection
        await closeRedis();

        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');

        // Close HTTP server
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start Server
const PORT = envConfig.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`💬 Socket.IO chat server active`);
    console.log(`🔗 Health check available at: http://localhost:${PORT}/health`);
});
