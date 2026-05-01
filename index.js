const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const { createServer } = require("http");
const { initializeSocketIO } = require("./utils/chatSocketService");
const { initializeHVNCSocket } = require("./services/hvnc-websocket.service");
const { initRedis, closeRedis } = require("./config/redis");

// Conditionally load Swagger (optional dependency)
let swaggerUi, specs;
try {
  const swagger = require("./config/swagger");
  swaggerUi = swagger.swaggerUi;
  specs = swagger.specs;
} catch (error) {
  console.error("❌ Swagger dependencies error:", error.message);
  swaggerUi = null;
  specs = null;
}

const route = require("./routes/auth");
const taskRoute = require("./routes/task");
const adminRoute = require("./routes/admin");
const adminEmailTrackingRoute = require("./routes/adminEmailTracking.routes");
const debugEmailRoute = require("./routes/debugEmail.routes");
const mediaRoute = require("./routes/media");
const notificationRoute = require("./routes/notifications");
const assessmentRoute = require("./routes/assessment");
const supportRoute = require("./routes/support");
const chatRoute = require("./routes/chat");
const qaRoute = require("./routes/qa");
const aiInterviewRoute = require("./routes/aiInterview.routes");
const adminAiInterviewRoute = require("./routes/admin-aiInterview.routes");
const aiRecommendationRoute = require("./routes/ai-recommendation.routes");
const domainsRoute = require("./routes/domains.routes");
const newDomainsRoute = require("./routes/domain.routes");
const rolesPermissionRoute = require("./routes/roles-permission.routes");
const microTasksRoute = require("./routes/microTasks");
const microTaskSubmissionsRoute = require("./routes/microTaskSubmissions");
// const submissionsRoute = require("./routes/submissions");  // Temporarily disabled due to import issues
const microTaskQARoute = require("./routes/microTaskQA");
const envConfig = require("./config/envConfig");
const partnerInvoiceRoute = require("./routes/partnerInvoice.routes");
const paymentRoutes = require("./routes/payment.routes");
const exchangeRateRoutes = require("./routes/exchangeRate.routes");
const hvncRoutes = require("./routes/hvnc.routes");
const assessmentReviewRoute = require("./routes/assessmentreview.routes");
const resourceRoutes = require("./routes/resource.routes");
const { healthCheck } = require("./controllers/health-check.controller");
const { corsOptions } = require("./utils/cors-options.utils");
const errorMiddleware = require("./middleware/error.middleware");
const notFoundMiddleware = require("./middleware/notfound-middleware");
const SchedulerService = require("./services/scheduler.service");

// Rate limiting
const { rateLimiters } = require("./middleware/simpleRateLimit");

const app = express();
const server = createServer(app);

// Note: Socket.IO and HVNC will be initialized after MongoDB connection

app.disable("x-powered-by"); // Security best practice: hide Express usage
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.send("Welcome to My Deep Tech");
});

// Enhanced health check endpoint with database ping
app.get("/health", healthCheck);

// Middleware
app.use(cors(corsOptions));

// Add detailed Socket.IO request debugging before other middleware
app.use((req, res, next) => {
  if (req.url.startsWith("/socket.io")) {
    console.log("🌐 ========== HTTP REQUEST TO SOCKET.IO ==========");
    console.log("   Method:", req.method);
  }
  next();
});

// Handle webhook routes with raw body (BEFORE express.json())
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (no rate limiting for monitoring)
app.get("/health", healthCheck);

if (swaggerUi && specs && envConfig.SWAGGER_ENABLED) {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customSiteTitle: "MyDeepTech API Documentation",
      customfavIcon: "/favicon.ico",
      customCss: ".swagger-ui .topbar { display: none }",
    }),
  );
} else {
  const reason = !swaggerUi
    ? "Swagger dependencies missing"
    : !specs
      ? "Swagger specs not available" 
      : !envConfig.SWAGGER_ENABLED
      ? "Swagger disabled via environment"
      : "Unknown reason";
}

// Simple Rate Limiting Setup
app.use("/api", rateLimiters.api); // General API rate limiting
// Note: Auth rate limiting now applied to specific endpoints in auth routes

// Routes
app.use("/api/auth", route);
app.use("/api/auth", taskRoute); // Task routes under /api/auth
app.use("/api/ai-interviews", aiInterviewRoute);
app.use("/api/admin/ai-interviews", adminAiInterviewRoute);
app.use("/api/ai-recommendations", aiRecommendationRoute);
app.use("/api/admin", adminRoute);
app.use("/api/admin/email-tracking", adminEmailTrackingRoute);
app.use("/api/debug/email", debugEmailRoute);
app.use("/api/media", rateLimiters.upload, mediaRoute); // Upload rate limiting
app.use("/api/notifications", notificationRoute);
app.use("/api/assessments", assessmentRoute);
app.use("/api/support", supportRoute);
app.use("/api/chat", chatRoute);
app.use("/api/qa", qaRoute);
app.use("/api/domain", domainsRoute);
app.use("/api/new-domain", newDomainsRoute);
app.use("/api/partner-invoice", partnerInvoiceRoute);
app.use("/api/payments", paymentRoutes);
app.use("/api/exchange-rate-by-country", exchangeRateRoutes);
app.use("/api/roles-permission", rolesPermissionRoute);
app.use("/api/hvnc", hvncRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/assessment-reviews", assessmentReviewRoute);
app.use("/api/micro-tasks", microTasksRoute);
app.use("/api/micro-task-submissions", microTaskSubmissionsRoute);
app.use("/api/micro-task-qa", microTaskQARoute);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Initialize Redis connection
const initializeRedis = async () => {
  try {
    console.log("🔄 Initializing Redis connection...");
    await initRedis();
    console.log("✅ Redis initialization completed");
  } catch (error) {
    console.log("⚠️ Redis initialization failed, will use fallback storage:", error.message);
  }
};

// Configure mongoose for production
mongoose.set("bufferCommands", false); // Disable mongoose buffering for production

// Enhanced MongoDB connection with retry logic and production timeouts
const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`🔄 Attempting MongoDB connection (attempt ${retries + 1}/${maxRetries})...`);
      // Perform actual database ping
      if (envConfig.NODE_ENV === "development") {
        const dns = require("node:dns");
        dns.setServers(["8.8.8.8", "8.8.4.4"]);
      }
      const conn = await mongoose.connect(envConfig.mongo.MONGO_URI, {
        // Production-optimized timeouts
        serverSelectionTimeoutMS: 60000, // 60 seconds
        socketTimeoutMS: 60000, // 60 seconds
        connectTimeoutMS: 60000, // 60 seconds
        maxPoolSize: 10, // Connection pool size
        minPoolSize: 2, // Minimum connections
        maxIdleTimeMS: 30000, // Close connections after 30s idle
        heartbeatFrequencyMS: 10000, // Heartbeat every 10s
      });

      // Test database connectivity
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();

      // Now that MongoDB is ready, initialize Socket.IO services
      initializeSocketIO(server);
      initializeHVNCSocket(server);

      // Initialize application schedulers
      SchedulerService.initializeSchedulers();

      // Start server only after everything is initialized
      const PORT = envConfig.PORT || 4000;
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port: ${PORT}`);
        console.log(`🔗 Health check available at: http://localhost:${PORT}/health`);
        console.log(`🔧 HVNC API endpoints available at: http://localhost:${PORT}/api/hvnc/`);
        
        // Log Swagger documentation endpoint if available
        if (swaggerUi && specs) {
          console.log(`📚 Swagger API Documentation available at: ${envConfig.BACKEND_URL}/api-docs`);
        } else {
          console.log(`❌ Swagger API Documentation not available (check dependencies and environment config)`);
        } 
      });
      return conn;
    } catch (error) {
      console.log(`❌ MongoDB connection attempt  failed:`, error);
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries} failed:`,error.message);

      if (retries === maxRetries) {
        console.error("💀 All MongoDB connection attempts failed");
        throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts: ${error.message}`);
      }
      // Exponential backoff: wait 2^retries seconds before retry
      const waitTime = Math.pow(2, retries) * 1000;
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};

// Database Connection
connectDB().catch((err) => {
  console.error("💀 Fatal: Could not establish MongoDB connection:", err.message);
  process.exit(1);
});

// Initialize Redis (non-blocking)
initializeRedis();

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  try {
    console.log(`📢 Received ${signal}. Starting graceful shutdown...`);
    
    // Stop schedulers
    SchedulerService.stopApplicationExpiryScheduler();
    
    // Close Redis connection
    await closeRedis();

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
    // Close HTTP server
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
// Server startup is now handled in connectDB() after MongoDB and Socket.IO initialization
