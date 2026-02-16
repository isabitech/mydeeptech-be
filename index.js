const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createServer } = require('http');
const { initializeSocketIO } = require('./utils/chatSocketService');
const { initRedis, closeRedis } = require('./config/redis');

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
const adminEmailTrackingRoute = require('./routes/adminEmailTracking.routes');
const debugEmailRoute = require('./routes/debugEmail.routes');
const mediaRoute = require('./routes/media');
const notificationRoute = require('./routes/notifications');
const assessmentRoute = require('./routes/assessment');
const supportRoute = require('./routes/support');
const chatRoute = require('./routes/chat');
const qaRoute = require('./routes/qa');
const domainsRoute = require('./routes/domain.routes');
const envConfig = require('./config/envConfig');
const { healthCheck } = require('./controllers/health-check.controller');
const { corsOptions } = require('./utils/cors-options.utils');

const app = express();
const server = createServer(app);

// Initialize Socket.IO for chat functionality
initializeSocketIO(server);


app.get("/", (_req, res) => {
    res.send('Welcome to My Deep Tech');
});

// Enhanced health check endpoint with database ping
app.get("/health", healthCheck);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(bodyParser.json());

// API Documentation (only if Swagger is available and enabled)
if (swaggerUi && specs) {
  // Debug logging for Swagger configuration
  console.log('🔧 Swagger Configuration Debug:');
  console.log(`   NODE_ENV: ${envConfig.NODE_ENV}`);
  console.log(`   SWAGGER_URL: ${envConfig.SWAGGER_URL}`);
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customSiteTitle: "MyDeepTech API Documentation",
    customfavIcon: "/favicon.ico",
    customCss: '.swagger-ui .topbar { display: none }'
  }));
  console.log(`📚 API Documentation available at: ${envConfig.SWAGGER_URL}/api-docs`);
} else {
  const reason = !swaggerUi ? 'Swagger dependencies missing' : 
                !envConfig.SWAGGER_ENABLED ? 'Swagger disabled via environment' : 
                'Swagger specs not available';
  console.log(`📚 API Documentation not available (${reason})`);
}

// Routes
app.use('/api/auth', route);
app.use('/api/admin', adminRoute);
app.use('/api/admin/email-tracking', adminEmailTrackingRoute);
app.use('/api/debug/email', debugEmailRoute);
app.use('/api/media', mediaRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/assessments', assessmentRoute);
app.use('/api/support', supportRoute);
app.use('/api/chat', chatRoute);
app.use('/api/qa', qaRoute);
app.use('/api/domain', domainsRoute);

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
