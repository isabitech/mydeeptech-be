const mongoose = require('mongoose');

const adminRegistrationStateSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  currentStep: {
    type: String,
    required: true,
    enum: ['signup', 'verify-otp'],
    default: 'signup'
  },
  formData: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    confirmPassword: { type: String, required: true },
    adminKey: { type: String, required: true }
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    default: null
  },
  deviceInfo: {
    userAgent: String,
    ipAddress: String,
    lastDeviceType: String // 'desktop', 'mobile', 'tablet'
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    index: { expireAfterSeconds: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
adminRegistrationStateSchema.index({ email: 1, currentStep: 1 });

// Update the updatedAt field before saving
adminRegistrationStateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to cleanup expired states (optional manual cleanup)
adminRegistrationStateSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({ 
    expiresAt: { $lt: new Date() } 
  });
  console.log(`Cleaned up ${result.deletedCount} expired registration states`);
  return result;
};

// Static method to find active registration by email
adminRegistrationStateSchema.statics.findActiveByEmail = async function(email) {
  return this.findOne({ 
    email: email.toLowerCase(),
    expiresAt: { $gt: new Date() }
  });
};

// Static method to save or update registration state
adminRegistrationStateSchema.statics.saveRegistrationState = async function(data) {
  const { email, currentStep, formData, adminId, deviceInfo } = data;
  
  const existingState = await this.findActiveByEmail(email);
  
  if (existingState) {
    // Update existing state
    existingState.currentStep = currentStep;
    existingState.formData = formData;
    if (adminId) existingState.adminId = adminId;
    if (deviceInfo) existingState.deviceInfo = deviceInfo;
    existingState.updatedAt = new Date();
    
    return await existingState.save();
  } else {
    // Create new state
    return await this.create({
      email: email.toLowerCase(),
      currentStep,
      formData,
      adminId,
      deviceInfo,
    });
  }
};

// Static method to complete registration (delete state)
adminRegistrationStateSchema.statics.completeRegistration = async function(email) {
  return await this.deleteOne({ email: email.toLowerCase() });
};

const AdminRegistrationState = mongoose.model('AdminRegistrationState', adminRegistrationStateSchema);

module.exports = AdminRegistrationState;