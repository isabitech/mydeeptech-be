const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const hvncAccessCodeSchema = new mongoose.Schema(
    {
        code_hash: {
            type: String,
            required: true,
            index: true
        },
        code_plain: {
            type: String,
            required: true,
            maxLength: 20,
            index: true
        },
        device_id: {
            type: String,
            required: true,
            ref: 'HVNCDevice',
            index: true
        },
        user_email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            ref: 'HVNCUser',
            index: true
        },
        expires_at: {
            type: Date,
            required: true,
            index: true
        },
        max_uses: {
            type: Number,
            default: 1,
            min: 1
        },
        used_count: {
            type: Number,
            default: 0,
            min: 0
        },
        is_active: {
            type: Boolean,
            default: true,
            index: true
        },
        usage_logs: [{
            used_at: {
                type: Date,
                default: Date.now
            },
            ip_address: String,
            session_id: String,
            success: {
                type: Boolean,
                default: false
            },
            failure_reason: String
        }],
        request_ip: String,
        request_user_agent: String,
        email_sent: {
            type: Boolean,
            default: false
        },
        email_sent_at: Date
    },
    {
        timestamps: true,
        toJSON: { 
            virtuals: true,
            transform: function(doc, ret) {
                delete ret.code_hash;
                delete ret.code_plain;
                return ret;
            }
        },
        toObject: { virtuals: true }
    }
);

// Virtual to check if code is expired
hvncAccessCodeSchema.virtual('is_expired').get(function() {
    return this.expires_at < new Date();
});

// Virtual to check if code is valid
hvncAccessCodeSchema.virtual('is_valid').get(function() {
    return this.is_active && 
           !this.is_expired && 
           this.used_count < this.max_uses;
});

// Virtual to check if code can be used
hvncAccessCodeSchema.virtual('can_use').get(function() {
    return this.is_valid && this.used_count < this.max_uses;
});

// Indexes for performance and cleanup
hvncAccessCodeSchema.index({ device_id: 1, user_email: 1 });
hvncAccessCodeSchema.index({ expires_at: 1 }); // For cleanup of expired codes
hvncAccessCodeSchema.index({ code_plain: 1, is_active: 1 });
hvncAccessCodeSchema.index({ user_email: 1, is_active: 1, expires_at: 1 });

// Instance methods
hvncAccessCodeSchema.methods.validateCode = function(inputCode) {
    if (!this.is_valid) {
        return false;
    }
    
    return bcrypt.compareSync(inputCode, this.code_hash) || 
           inputCode === this.code_plain;
};

hvncAccessCodeSchema.methods.useCode = function(sessionId, ipAddress) {
    if (!this.can_use) {
        throw new Error('Code cannot be used');
    }
    
    this.used_count += 1;
    this.usage_logs.push({
        used_at: new Date(),
        ip_address: ipAddress,
        session_id: sessionId,
        success: true
    });
    
    // Deactivate if max uses reached
    if (this.used_count >= this.max_uses) {
        this.is_active = false;
    }
    
    return this.save();
};

hvncAccessCodeSchema.methods.recordFailedUse = function(ipAddress, reason) {
    this.usage_logs.push({
        used_at: new Date(),
        ip_address: ipAddress,
        success: false,
        failure_reason: reason
    });
    
    return this.save();
};

hvncAccessCodeSchema.methods.deactivate = function(reason = 'manually_disabled') {
    this.is_active = false;
    this.usage_logs.push({
        used_at: new Date(),
        success: false,
        failure_reason: reason
    });
    
    return this.save();
};

// Static methods
hvncAccessCodeSchema.statics.generateCode = function() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

hvncAccessCodeSchema.statics.createForUser = async function(userEmail, deviceId, ipAddress, expiresInHours = 24) {
    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    
    const accessCode = new this({
        code_hash: codeHash,
        code_plain: code, // Store plain for initial email, will be removed after sending
        device_id: deviceId,
        user_email: userEmail.toLowerCase(),
        expires_at: expiresAt,
        request_ip: ipAddress,
        max_uses: 1
    });
    
    await accessCode.save();
    return { accessCode, code };
};

hvncAccessCodeSchema.statics.findValidCode = function(code, deviceId, userEmail) {
    const now = new Date();
    return this.findOne({
        code_plain: code,
        device_id: deviceId,
        user_email: userEmail.toLowerCase(),
        is_active: true,
        expires_at: { $gt: now },
        $expr: { $lt: ['$used_count', '$max_uses'] }
    });
};

hvncAccessCodeSchema.statics.invalidateUserCodes = function(userEmail, deviceId) {
    return this.updateMany(
        {
            user_email: userEmail.toLowerCase(),
            device_id: deviceId,
            is_active: true
        },
        {
            $set: { is_active: false },
            $push: {
                usage_logs: {
                    used_at: new Date(),
                    success: false,
                    failure_reason: 'invalidated_new_code_generated'
                }
            }
        }
    );
};

hvncAccessCodeSchema.statics.cleanupExpired = function() {
    return this.deleteMany({
        expires_at: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days ago
    });
};

// Pre-save middleware
hvncAccessCodeSchema.pre('save', function(next) {
    if (this.user_email) {
        this.user_email = this.user_email.toLowerCase();
    }
    next();
});

// TTL index for automatic cleanup of expired codes (MongoDB feature)
hvncAccessCodeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // 7 days

module.exports = mongoose.model('HVNCAccessCode', hvncAccessCodeSchema);