/**
 * HVNC Database Migration & Initialization Script
 * 
 * This script handles:
 * - Database schema verification
 * - Default admin user creation
 * - Index creation for performance
 * - Data cleanup and maintenance
 * - System configuration setup
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const envConfig = require('../config/envConfig');

// Import all HVNC models
const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const HVNCAccessCode = require('../models/hvnc-access-code.model');
const HVNCSession = require('../models/hvnc-session.model');
const HVNCShift = require('../models/hvnc-shift.model');
const HVNCActivityLog = require('../models/hvnc-activity-log.model');
const HVNCCommand = require('../models/hvnc-command.model');

/**
 * Create database indexes for optimal performance
 */
async function createIndexes() {
  console.log('📊 Creating database indexes...');
  
  try {
    const indexOperations = [
      // HVNC Devices indexes
      HVNCDevice.collection.createIndex({ device_id: 1 }, { unique: true }),
      HVNCDevice.collection.createIndex({ status: 1 }),
      HVNCDevice.collection.createIndex({ last_seen: 1 }),
      HVNCDevice.collection.createIndex({ fingerprint: 1 }),
      HVNCDevice.collection.createIndex({ 'location.ip': 1 }),
      
      // HVNC Users indexes
      HVNCUser.collection.createIndex({ email: 1 }, { unique: true }),
      HVNCUser.collection.createIndex({ status: 1 }),
      HVNCUser.collection.createIndex({ role: 1 }),
      HVNCUser.collection.createIndex({ last_login: 1 }),
      HVNCUser.collection.createIndex({ 'account_security.locked_until': 1 }),
      
      // HVNC Access Codes indexes
      HVNCAccessCode.collection.createIndex({ code: 1 }, { unique: true }),
      HVNCAccessCode.collection.createIndex({ user_email: 1 }),
      HVNCAccessCode.collection.createIndex({ expires_at: 1 }),
      HVNCAccessCode.collection.createIndex({ status: 1 }),
      HVNCAccessCode.collection.createIndex({ created_at: 1 }),
      
      // HVNC Sessions indexes
      HVNCSession.collection.createIndex({ session_id: 1 }, { unique: true }),
      HVNCSession.collection.createIndex({ user_email: 1 }),
      HVNCSession.collection.createIndex({ device_id: 1 }),
      HVNCSession.collection.createIndex({ status: 1 }),
      HVNCSession.collection.createIndex({ started_at: 1 }),
      HVNCSession.collection.createIndex({ ended_at: 1 }),
      HVNCSession.collection.createIndex({ is_active: 1 }),
      
      // HVNC Activity Logs indexes
      HVNCActivityLog.collection.createIndex({ timestamp: -1 }),
      HVNCActivityLog.collection.createIndex({ event_type: 1 }),
      HVNCActivityLog.collection.createIndex({ user_email: 1 }),
      HVNCActivityLog.collection.createIndex({ device_id: 1 }),
      HVNCActivityLog.collection.createIndex({ session_id: 1 }),
      HVNCActivityLog.collection.createIndex({ severity: 1 }),
      HVNCActivityLog.collection.createIndex({ is_flagged: 1 }),
      
      // HVNC Commands indexes
      HVNCCommand.collection.createIndex({ command_id: 1 }, { unique: true }),
      HVNCCommand.collection.createIndex({ device_id: 1 }),
      HVNCCommand.collection.createIndex({ session_id: 1 }),
      HVNCCommand.collection.createIndex({ status: 1 }),
      HVNCCommand.collection.createIndex({ created_at: 1 }),
      HVNCCommand.collection.createIndex({ expires_at: 1 }),
      HVNCCommand.collection.createIndex({ priority: 1 }),
      
      // HVNC Shifts indexes
      HVNCShift.collection.createIndex({ date: 1 }),
      HVNCShift.collection.createIndex({ is_holiday: 1 }),
      HVNCShift.collection.createIndex({ is_weekend: 1 }),
      HVNCShift.collection.createIndex({ 'hours.start_time': 1 }),
      HVNCShift.collection.createIndex({ 'hours.end_time': 1 }),
      
      // Compound indexes for common queries
      HVNCSession.collection.createIndex({ user_email: 1, started_at: -1 }),
      HVNCSession.collection.createIndex({ device_id: 1, status: 1 }),
      HVNCDevice.collection.createIndex({ status: 1, last_seen: -1 }),
      HVNCActivityLog.collection.createIndex({ timestamp: -1, severity: 1 }),
      HVNCCommand.collection.createIndex({ device_id: 1, status: 1, created_at: -1 }),
    ];
    
    await Promise.all(indexOperations);
    
    // Text indexes for search functionality
    await HVNCActivityLog.collection.createIndex({ 
      '$**': 'text' 
    }, { 
      name: 'activity_log_text_search',
      weights: {
        'event_data.summary': 10,
        'event_data.details': 5,
        'user_email': 3,
        'device_id': 2
      }
    });
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

/**
 * Create default admin user if it doesn't exist
 */
async function createDefaultAdmin() {
  console.log('👤 Checking default admin user...');
  
  try {
    const adminEmail = envConfig.hvnc.DEFAULT_ADMIN_EMAIL || 
                      envConfig.admin.NEW_ADMIN_EMAIL;
    const adminPassword = envConfig.hvnc.DEFAULT_ADMIN_PASSWORD || 
                          envConfig.admin.NEW_ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      console.log('⚠️ No default admin credentials provided, skipping admin creation');
      return;
    }
    
    // Check if admin already exists
    const existingAdmin = await HVNCUser.findOne({ 
      email: adminEmail.toLowerCase(),
      role: { $in: ['admin', 'supervisor'] }
    });
    
    if (existingAdmin) {
      console.log(`✅ Admin user already exists: ${adminEmail}`);
      return;
    }
    
    // Create new admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    const adminUser = new HVNCUser({
      email: adminEmail.toLowerCase(),
      password_hash: hashedPassword,
      full_name: 'System Administrator',
      role: 'admin',
      status: 'active',
      permissions: [
        'device_management',
        'user_management', 
        'admin_dashboard'
      ]
    });
    
    await adminUser.save();
    
    // Log admin creation
    await HVNCActivityLog.logUserEvent(
      adminEmail.toLowerCase(),
      'admin_created',
      {
        summary: 'Default admin user created during migration',
        role: 'admin',
        permissions: adminUser.permissions,
        created_by: 'system_migration'
      },
      {
        severity: 'info',
        status: 'success',
        ip_address: '127.0.0.1'
      }
    );
    
    console.log(`✅ Default admin user created: ${adminEmail}`);
    console.log(`🔑 Admin role: admin`);
    
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
    throw error;
  }
}

/**
 * Initialize shift configuration
 */
async function initializeShifts() {
  console.log('⏰ Initializing shift configuration...');
  
  try {
    // Check if any shifts are already configured
    const existingShifts = await HVNCShift.countDocuments();
    
    if (existingShifts > 0) {
      console.log(`✅ Shifts already configured (${existingShifts} entries)`);
      return;
    }
    
    // Only create default if shift enforcement is enabled
    if (!envConfig.hvnc.ENFORCE_SHIFTS) {
      console.log('⚠️ Shift enforcement disabled, skipping shift initialization');
      return;
    }
    
    // Create default shifts for the next 30 days
    const shifts = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of today
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const shift = new HVNCShift({
        date: date,
        is_active: !isWeekend, // Work days active by default
        is_holiday: false,
        is_weekend: isWeekend,
        hours: {
          start_time: envConfig.hvnc.SHIFT_START_TIME,
          end_time: envConfig.hvnc.SHIFT_END_TIME,
          timezone: envConfig.hvnc.SHIFT_TIMEZONE
        },
        metadata: {
          created_by: 'system_migration',
          notes: 'Default shift configuration'
        }
      });
      
      shifts.push(shift);
    }
    
    await HVNCShift.insertMany(shifts);
    
    console.log(`✅ Created ${shifts.length} default shifts`);
    console.log(`📅 Shift hours: ${envConfig.hvnc.SHIFT_START_TIME} - ${envConfig.hvnc.SHIFT_END_TIME} (${envConfig.hvnc.SHIFT_TIMEZONE})`);
    
  } catch (error) {
    console.error('❌ Error initializing shifts:', error);
    throw error;
  }
}

/**
 * Clean up expired data
 */
async function cleanupExpiredData() {
  console.log('🧹 Cleaning up expired data...');
  
  try {
    const now = new Date();
    const results = {};
    
    // Remove expired access codes
    const expiredCodes = await HVNCAccessCode.deleteMany({
      expires_at: { $lt: now },
      status: { $in: ['pending', 'expired'] }
    });
    results.expired_access_codes = expiredCodes.deletedCount;
    
    // Remove old activity logs (keep last 90 days or configured retention)
    const retentionPeriod = envConfig.hvnc.ACTIVITY_LOG_RETENTION || '90d';
    const retentionDays = parseInt(retentionPeriod.replace('d', '')) || 90;
    const retentionDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));
    
    const oldLogs = await HVNCActivityLog.deleteMany({
      timestamp: { $lt: retentionDate },
      severity: { $nin: ['error', 'warning'] } // Keep error/warning logs longer
    });
    results.old_activity_logs = oldLogs.deletedCount;
    
    // Mark old commands as expired
    const expiredCommands = await HVNCCommand.updateMany(
      {
        expires_at: { $lt: now },
        status: { $in: ['pending', 'sent'] }
      },
      {
        $set: {
          status: 'expired',
          completed_at: now,
          result: { error: 'Command expired' }
        }
      }
    );
    results.expired_commands = expiredCommands.modifiedCount;
    
    // Update device status for devices that haven't been seen
    const offlineThreshold = new Date(now.getTime() - envConfig.hvnc.DEVICE_OFFLINE_THRESHOLD);
    const staleDevices = await HVNCDevice.updateMany(
      {
        last_seen: { $lt: offlineThreshold },
        status: { $in: ['online', 'busy'] }
      },
      {
        $set: { status: 'offline' }
      }
    );
    results.stale_devices = staleDevices.modifiedCount;
    
    console.log('✅ Cleanup completed:', results);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting HVNC database migration...');
  
  try {
    // Verify all models are loaded
    console.log('📋 Verifying models...');
    const models = [
      HVNCUser,
      HVNCDevice,
      HVNCAccessCode,
      HVNCSession,
      HVNCShift,
      HVNCActivityLog,
      HVNCCommand
    ];
    
    for (const model of models) {
      console.log(`  ✓ ${model.modelName} model loaded`);
    }
    
    // Run migration steps
    await createIndexes();
    await createDefaultAdmin();
    await initializeShifts();
    await cleanupExpiredData();
    
    console.log('✅ HVNC migration completed successfully!');
    console.log('\n🎉 HVNC system is ready to use:');
    console.log('   - Database indexes created');
    console.log('   - Admin user configured');
    console.log('   - Shift schedules initialized');
    console.log('   - Expired data cleaned up');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Migration verification function
 */
async function verifyMigration() {
  console.log('🔍 Verifying migration...');
  
  try {
    const stats = {
      total_users: await HVNCUser.countDocuments(),
      admin_users: await HVNCUser.countDocuments({ role: { $in: ['admin', 'super_admin'] } }),
      total_devices: await HVNCDevice.countDocuments(),
      active_shifts: await HVNCShift.countDocuments({ is_active: true }),
      total_sessions: await HVNCSession.countDocuments(),
      activity_logs: await HVNCActivityLog.countDocuments(),
    };
    
    console.log('📊 Migration verification results:', stats);
    
    // Verify indexes
    const collections = [
      'hvnc_users',
      'hvnc_devices', 
      'hvnc_access_codes',
      'hvnc_sessions',
      'hvnc_activity_logs',
      'hvnc_commands',
      'hvnc_shifts'
    ];
    
    for (const collectionName of collections) {
      const indexes = await mongoose.connection.db.collection(collectionName).indexes();
      console.log(`  ✓ ${collectionName}: ${indexes.length} indexes`);
    }
    
    console.log('✅ Migration verification completed');
    return stats;
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    throw error;
  }
}

// Export functions for use in other scripts
module.exports = {
  runMigration,
  verifyMigration,
  createIndexes,
  createDefaultAdmin,
  initializeShifts,
  cleanupExpiredData
};

// Run migration if called directly
if (require.main === module) {
  const connectDB = async () => {
    try {
      await mongoose.connect(envConfig.mongo.MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 30000,
      });
      console.log('📊 Connected to MongoDB for migration');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  };
  
  connectDB()
    .then(() => runMigration())
    .then(() => verifyMigration())
    .then(() => {
      console.log('\n🎊 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}