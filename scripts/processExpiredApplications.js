const mongoose = require('mongoose');
const ApplicationExpiryService = require('../services/applicationExpiry.service');
const envConfig = require('../config/envConfig');
require('dotenv').config();

/**
 * Scheduled job to process expired applications
 * This script should be run via cron job or scheduled task
 *
 * Recommended cron schedule: Every 6 hours
 * 0 * /6 * * * /usr/bin/node /path/to/this/script.js
 *
 * Or daily at midnight:
 * 0 0 * * * /usr/bin/node /path/to/this/script.js
 */

// Database connection
const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Set DNS servers for development
    if (envConfig.NODE_ENV === "development") {
      const dns = require("node:dns");
      dns.setServers(["8.8.8.8", "8.8.4.4"]);
    }
    
    await mongoose.connect(envConfig.mongo.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Main function to process expired applications
const processExpiredApplications = async () => {
  try {
    console.log(`\n🚀 Starting expired application processing job at ${new Date().toISOString()}`);
    console.log('=' * 60);

    const expiryService = new ApplicationExpiryService();
    
    // Process expired applications
    const result = await expiryService.processExpiredApplications();
    
    console.log('\n📊 Processing Summary:');
    console.log(`   • Applications processed: ${result.processedCount}`);
    console.log(`   • Errors encountered: ${result.errorCount}`);
    console.log(`   • Processed at: ${result.processedAt.toISOString()}`);
    
    if (result.processedApplications.length > 0) {
      console.log('\n📋 Processed Applications:');
      result.processedApplications.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.applicantName} - "${app.projectName}" (Expired: ${app.expiryDate.toLocaleDateString()})`);
      });
    }
    
    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. Application ${error.applicationId}: ${error.error} - ${error.details}`);
      });
    }

    // Get upcoming expirations (next 24 hours) for monitoring
    const upcomingExpirations = await expiryService.getApplicationsExpiringSoon(24);
    if (upcomingExpirations.count > 0) {
      console.log(`\n⏰ ${upcomingExpirations.count} applications expiring in the next 24 hours:`);
      upcomingExpirations.applications.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.applicantName} - "${app.projectName}" (${app.hoursUntilExpiry} hours remaining)`);
      });
    }
    
    console.log('\n✅ Expired application processing completed successfully');
    
  } catch (error) {
    console.error('❌ Critical error during processing:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Main execution
const main = async () => {
  try {
    await connectDB();
    await processExpiredApplications();
    await gracefulShutdown();
  } catch (error) {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  }
};

// Execute if this script is run directly
if (require.main === module) {
  main();
}

module.exports = { processExpiredApplications, connectDB };