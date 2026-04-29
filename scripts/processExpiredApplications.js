const mongoose = require('mongoose');
const ApplicationExpiryService = require('../services/applicationExpiry.service');
const envConfig = require('../config/envConfig');
require('dotenv').config();

// Load required models for populate operations

 /**
 * Scheduled job to process expired applications with batch processing
 * This script should be run via cron job or scheduled task
 *
 * Features:
 * - Batch processing to handle large volumes (200+ applications)
 * - Rate-limited email sending to prevent overwhelming email service
 * - Configurable batch sizes and delays
 * - Comprehensive error handling and monitoring
 * - Production and development optimized settings
 *
 * Recommended cron schedule: Every 6 hours
 * 0 *\/6 * * * /usr/bin/node /path/to/this/script.js
 *
 * Or daily at midnight:
 * 0 0 * * * /usr/bin/node /path/to/this/script.js
 *
 * Performance: Can handle 200+ expired applications efficiently:
 * - Database: Processes in batches of 20-50 applications
 * - Emails: Sends in batches of 10-15 with 5-8 second delays
 * - Total time for 200 applications: ~2-3 minutes
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
    
    await mongoose.connect(envConfig.mongo.MONGO_URI);

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
    console.log('='.repeat(60));

    const expiryService = new ApplicationExpiryService();

    const isProduction = envConfig.NODE_ENV === 'production';

    // Configure batch processing based on environment and expected volume
    const batchOptions = {
      // Number of applications to process per batch (database operations)
      batchSize: isProduction ? 50 : 20,
      
      // Number of emails to send per batch
      emailBatchSize: isProduction ? 15 : 10,
      
      // Delay between email batches in milliseconds (respects rate limits)
      delayBetweenBatches: isProduction ? 8000 : 5000 // 8s or 5s
    };

    console.log(`⚙️  Batch configuration:`);
    console.log(`   • Application batch size: ${batchOptions.batchSize}`);
    console.log(`   • Email batch size: ${batchOptions.emailBatchSize}`);  
    console.log(`   • Delay between email batches: ${batchOptions.delayBetweenBatches}ms`);

    // Process expired applications with batch processing
    const result = await expiryService.processExpiredApplications(batchOptions);

    console.log('\n📊 Processing Summary:');
    console.log(`   • Applications processed: ${result.processedCount}`);
    console.log(`   • Errors encountered: ${result.errorCount}`);
    console.log(`   • Processed at: ${result.processedAt.toISOString()}`);
    
    if (result.batchingStats) {
      console.log('\n📈 Batching Statistics:');
      console.log(`   • Total applications found: ${result.batchingStats.totalApplications}`);
      console.log(`   • Application batch size: ${result.batchingStats.applicationBatchSize}`);
      console.log(`   • Email batch size: ${result.batchingStats.emailBatchSize}`);
      console.log(`   • Total emails sent: ${result.batchingStats.totalEmailsSent}`);
    }
    
    if (result.processedApplications.length > 0) {
      console.log('\n📋 Processed Applications:');
      result.processedApplications.slice(0, 10).forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.applicantName} - "${app.projectName}" (Expired: ${app.expiryDate.toLocaleDateString()})`);
      });
      
      if (result.processedApplications.length > 10) {
        console.log(`   ... and ${result.processedApplications.length - 10} more applications`);
      }
    }

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. Application ${error.applicationId}: ${error.error}`);
        if (error.email) {
          console.log(`      Email: ${error.email}`);
        }
        if (error.details) {
          console.log(`      Details: ${error.details}`);
        }
      });
      
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Get upcoming expirations (next 24 hours) for monitoring
    const upcomingExpirations = await expiryService.getApplicationsExpiringSoon(24);
    if (upcomingExpirations.count > 0) {
      console.log(`\n⏰ ${upcomingExpirations.count} applications expiring in the next 24 hours:`);
      upcomingExpirations.applications.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.applicantName} - "${app.projectName}" (${app.hoursUntilExpiry} hours remaining)`);
      });
    }
    
    console.log('\n Expired application processing completed successfully');
    
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