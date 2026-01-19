import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { initializeSocketIO } from './utils/chatSocketService.js';
import errorHandler from './middleware/errorHandler.js';
import { swaggerUi, specs } from './config/swagger.js';
import { redisHealthCheck } from './config/redis.js';
import mongoose from 'mongoose';

// Route imports
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import mediaRoutes from './routes/media.js';
import notificationRoutes from './routes/notifications.js';
import assessmentRoutes from './routes/assessment.js';
import supportRoutes from './routes/support.js';
import chatRoutes from './routes/chat.js';
import qaRoutes from './routes/qa.js';

const app = express();
const server = createServer(app);

// Initialize Socket.IO for chat functionality
initializeSocketIO(server);

// CORS Configuration
const corsOptions = {
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://mydeeptech.ng',
        'https://www.mydeeptech.ng',
        'https://mydeeptech-be.onrender.com',
        'https://mydeeptech-frontend.onrender.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'token']
};

// Health check endpoint
app.get("/health", async (req, res) => {
    try {
        const redisStatus = await redisHealthCheck();
        let mongoStatus = 'disconnected';
        let mongoDetails = { status: 'disconnected' };

        if (mongoose.connection.readyState === 1) {
            try {
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
            services: { mongodb: mongoDetails, redis: redisStatus }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get("/", (req, res) => {
    res.send('Welcome to My Deep Tech')
});

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes",
        code: "RATE_LIMIT_EXCEEDED"
    }
});
app.use('/api/', limiter);

// Swagger Documentation
if (swaggerUi && specs) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
        explorer: true,
        customSiteTitle: "MyDeepTech API Documentation",
        customfavIcon: "/favicon.ico",
        customCss: '.swagger-ui .topbar { display: none }'
    }));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/qa', qaRoutes);

// Global Error Handler
app.use(errorHandler);

export { app, server };
