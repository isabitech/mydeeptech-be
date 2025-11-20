const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { createServer } = require('http');
const { initializeSocketIO } = require('./utils/chatSocketService');
const { initRedis, closeRedis, redisHealthCheck } = require('./config/redis');

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

dotenv.config({ path: './.env' });

//console.log("Loaded BREVO_API_KEY:", process.env.BREVO_API_KEY ? "✅ Yes" : "❌ No");

const route = require('./routes/auth');
const adminRoute = require('./routes/admin');
const mediaRoute = require('./routes/media');
const notificationRoute = require('./routes/notifications');
const assessmentRoute = require('./routes/assessment');
const supportRoute = require('./routes/support');
const chatRoute = require('./routes/chat');

const app = express();
const server = createServer(app);

// Initialize Socket.IO for chat functionality
initializeSocketIO(server);

// CORS Configuration
const corsOptions = {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://mydeeptech.ng', 'https://www.mydeeptech.ng'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'token']
};

app.get("/", (req, res) => {
    res.send('Welcome to My Deep Tech')
});

// Health check endpoint including Redis status
app.get("/health", async (req, res) => {
    try {
        const redisStatus = await redisHealthCheck();
        const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                mongodb: {
                    status: mongoStatus,
                    connection: mongoose.connection.host || 'unknown'
                },
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
app.use(express.urlencoded({extended: true}));
app.use(bodyParser.json());

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

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`💬 Socket.IO chat server active`);
    console.log(`🔗 Health check available at: http://localhost:${PORT}/health`);
});
