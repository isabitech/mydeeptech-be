const mongoose = require("mongoose");
const crypto = require("crypto");

const accessCodeSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['device_access', 'room_access', 'temporary', 'maintenance', 'emergency', 'guest'],
        default: 'device_access'
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'revoked', 'used', 'suspended'],
        default: 'active'
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        email: { type: String, trim: true },
        name: { type: String, trim: true },
        department: { type: String, trim: true }
    },
    permissions: [{
        resource: {
            type: String,
            enum: ['device', 'room', 'building', 'system'],
            required: true
        },
        resourceId: { 
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'permissions.resourceModel'
        },
        resourceModel: {
            type: String,
            enum: ['Device', 'Room', 'Building']
        },
        actions: [{
            type: String,
            enum: ['read', 'write', 'execute', 'admin', 'remote_access']
        }],
        restrictions: {
            timeRange: {
                start: { type: String }, // HH:MM format
                end: { type: String }   // HH:MM format
            },
            daysOfWeek: [{ 
                type: Number, 
                min: 0, 
                max: 6 
            }], // 0 = Sunday, 6 = Saturday
            ipWhitelist: [{ type: String }],
            maxSessions: { type: Number, default: 1 }
        }
    }],
    validity: {
        startDate: { 
            type: Date, 
            default: Date.now 
        },
        endDate: { 
            type: Date, 
            required: true 
        },
        maxUsages: { 
            type: Number, 
            default: null 
        }, // null = unlimited
        usageCount: { 
            type: Number, 
            default: 0 
        }
    },
    security: {
        requireTwoFactor: { type: Boolean, default: false },
        allowedDevices: [{ type: String }], // Device MAC addresses
        sessionTimeout: { type: Number, default: 3600 }, // seconds
        requireApproval: { type: Boolean, default: false },
        encryptionLevel: { 
            type: String, 
            enum: ['basic', 'standard', 'high'], 
            default: 'standard' 
        }
    },
    usage: [{
        usedAt: { type: Date, default: Date.now },
        usedBy: {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            ipAddress: { type: String },
            userAgent: { type: String },
            deviceInfo: { type: String }
        },
        action: { type: String, required: true },
        resource: { 
            type: String,
            required: true
        },
        success: { type: Boolean, default: true },
        notes: { type: String, trim: true },
        sessionId: { type: String },
        duration: { type: Number } // session duration in seconds
    }],
    approval: {
        required: { type: Boolean, default: false },
        status: { 
            type: String, 
            enum: ['pending', 'approved', 'rejected'], 
            default: 'approved' 
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: { type: Date },
        rejectionReason: { type: String, trim: true },
        conditions: [{ type: String, trim: true }]
    },
    notifications: {
        onGeneration: { type: Boolean, default: true },
        onUsage: { type: Boolean, default: false },
        onExpiration: { type: Boolean, default: true },
        reminderDays: { type: Number, default: 1 }, // days before expiration
        recipients: [{
            email: { type: String, trim: true },
            role: { 
                type: String, 
                enum: ['assignee', 'generator', 'admin', 'approver'] 
            }
        }]
    },
    revocation: {
        revokedAt: { type: Date },
        revokedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: { type: String, trim: true },
        isEmergency: { type: Boolean, default: false }
    },
    metadata: {
        purpose: { type: String, trim: true },
        project: { type: String, trim: true },
        cost: { type: Number },
        priority: { 
            type: String, 
            enum: ['low', 'normal', 'high', 'urgent'], 
            default: 'normal' 
        },
        tags: [{ type: String, trim: true }],
        customFields: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, {
    timestamps: true
});

// Indexes for better performance
accessCodeSchema.index({ code: 1 });
accessCodeSchema.index({ status: 1 });
accessCodeSchema.index({ generatedBy: 1 });
accessCodeSchema.index({ 'assignedTo.user': 1 });
accessCodeSchema.index({ 'validity.endDate': 1 });
accessCodeSchema.index({ 'permissions.resourceId': 1 });
accessCodeSchema.index({ createdAt: -1 });

// Virtual for checking if code is currently valid
accessCodeSchema.virtual('isValid').get(function() {
    const now = new Date();
    return this.status === 'active' &&
           now >= this.validity.startDate &&
           now <= this.validity.endDate &&
           (this.validity.maxUsages === null || this.validity.usageCount < this.validity.maxUsages);
});

// Virtual for remaining usages
accessCodeSchema.virtual('remainingUsages').get(function() {
    if (this.validity.maxUsages === null) return null;
    return Math.max(0, this.validity.maxUsages - this.validity.usageCount);
});

// Virtual for days until expiration
accessCodeSchema.virtual('daysUntilExpiration').get(function() {
    const now = new Date();
    const expiration = new Date(this.validity.endDate);
    const diffTime = expiration - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to validate code usage
accessCodeSchema.methods.canUse = function(userId, ipAddress, timeOfDay, dayOfWeek) {
    if (!this.isValid) return { valid: false, reason: 'Code is not valid' };
    
    // Check usage limit
    if (this.validity.maxUsages && this.validity.usageCount >= this.validity.maxUsages) {
        return { valid: false, reason: 'Usage limit exceeded' };
    }
    
    // Check permissions and restrictions
    for (const permission of this.permissions) {
        const restrictions = permission.restrictions;
        
        // Check time restrictions
        if (restrictions.timeRange && timeOfDay) {
            const start = restrictions.timeRange.start;
            const end = restrictions.timeRange.end;
            if (timeOfDay < start || timeOfDay > end) {
                return { valid: false, reason: 'Outside allowed time range' };
            }
        }
        
        // Check day restrictions
        if (restrictions.daysOfWeek && restrictions.daysOfWeek.length > 0) {
            if (!restrictions.daysOfWeek.includes(dayOfWeek)) {
                return { valid: false, reason: 'Not allowed on this day' };
            }
        }
        
        // Check IP whitelist
        if (restrictions.ipWhitelist && restrictions.ipWhitelist.length > 0) {
            if (!restrictions.ipWhitelist.includes(ipAddress)) {
                return { valid: false, reason: 'IP address not whitelisted' };
            }
        }
    }
    
    return { valid: true };
};

// Method to record usage
accessCodeSchema.methods.recordUsage = function(usageData) {
    this.usage.push(usageData);
    this.validity.usageCount += 1;
    
    // Auto-revoke if max usages reached
    if (this.validity.maxUsages && this.validity.usageCount >= this.validity.maxUsages) {
        this.status = 'used';
    }
    
    return this.save();
};

// Method to revoke code
accessCodeSchema.methods.revoke = function(revokedBy, reason, isEmergency = false) {
    this.status = 'revoked';
    this.revocation = {
        revokedAt: new Date(),
        revokedBy,
        reason,
        isEmergency
    };
    return this.save();
};

// Static method to generate unique code
accessCodeSchema.statics.generateUniqueCode = async function(length = 8, type = 'alphanumeric') {
    const characters = {
        numeric: '0123456789',
        alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        secure: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    };
    
    let charset = characters[type] || characters.alphanumeric;
    let code;
    let exists = true;
    
    while (exists) {
        code = '';
        for (let i = 0; i < length; i++) {
            code += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        exists = await this.exists({ code });
    }
    
    return code;
};

// Static method to cleanup expired codes
accessCodeSchema.statics.cleanupExpired = function() {
    const now = new Date();
    return this.updateMany(
        { 
            'validity.endDate': { $lt: now },
            status: 'active'
        },
        { 
            $set: { status: 'expired' } 
        }
    );
};

// Pre-save middleware to set defaults
accessCodeSchema.pre('save', async function(next) {
    if (this.isNew && !this.code) {
        this.code = await this.constructor.generateUniqueCode();
    }
    next();
});

module.exports = mongoose.model('AccessCode', accessCodeSchema);