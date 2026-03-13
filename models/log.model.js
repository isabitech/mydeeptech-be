const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
    level: {
        type: String,
        enum: ['debug', 'info', 'warn', 'error', 'fatal', 'trace'],
        default: 'info',
        required: true
    },
    category: {
        type: String,
        enum: ['system', 'security', 'user', 'device', 'access', 'shift', 'api', 'database', 'network', 'application'],
        required: true
    },
    action: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    source: {
        type: String,
        enum: ['web', 'mobile', 'api', 'system', 'scheduled', 'webhook', 'integration'],
        default: 'api'
    },
    user: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        email: { type: String, trim: true },
        role: { type: String, trim: true },
        ipAddress: { type: String, trim: true },
        userAgent: { type: String, trim: true }
    },
    device: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Device'
        },
        deviceId: { type: String, trim: true },
        name: { type: String, trim: true },
        type: { type: String, trim: true },
        ipAddress: { type: String, trim: true },
        macAddress: { type: String, trim: true }
    },
    resource: {
        type: { 
            type: String,
            enum: ['device', 'user', 'shift', 'accessCode', 'project', 'session', 'file', 'database', 'system']
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'resource.model'
        },
        model: {
            type: String,
            enum: ['Device', 'User', 'Shift', 'AccessCode', 'Project', 'Session']
        },
        name: { type: String, trim: true }
    },
    request: {
        method: { type: String, trim: true },
        url: { type: String, trim: true },
        headers: { type: mongoose.Schema.Types.Mixed },
        params: { type: mongoose.Schema.Types.Mixed },
        query: { type: mongoose.Schema.Types.Mixed },
        body: { type: mongoose.Schema.Types.Mixed },
        size: { type: Number } // request size in bytes
    },
    response: {
        statusCode: { type: Number },
        message: { type: String, trim: true },
        data: { type: mongoose.Schema.Types.Mixed },
        size: { type: Number }, // response size in bytes
        duration: { type: Number } // response time in ms
    },
    session: {
        id: { type: String, trim: true },
        startTime: { type: Date },
        endTime: { type: Date },
        duration: { type: Number } // session duration in seconds
    },
    security: {
        threat: {
            type: String,
            enum: ['none', 'low', 'medium', 'high', 'critical'],
            default: 'none'
        },
        blocked: { type: Boolean, default: false },
        reason: { type: String, trim: true },
        ruleId: { type: String, trim: true }
    },
    performance: {
        cpuUsage: { type: Number }, // percentage
        memoryUsage: { type: Number }, // bytes
        diskUsage: { type: Number }, // bytes
        networkUsage: { type: Number }, // bytes
        responseTime: { type: Number }, // milliseconds
        throughput: { type: Number } // requests per second
    },
    error: {
        code: { type: String, trim: true },
        stack: { type: String, trim: true },
        type: { type: String, trim: true },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        }
    },
    context: {
        environment: { 
            type: String, 
            enum: ['development', 'staging', 'production'], 
            default: 'production' 
        },
        version: { type: String, trim: true },
        service: { type: String, trim: true },
        instance: { type: String, trim: true },
        region: { type: String, trim: true }
    },
    metadata: {
        correlationId: { type: String, trim: true },
        parentLogId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Log' 
        },
        tags: [{ type: String, trim: true }],
        customFields: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    retention: {
        archiveAfterDays: { type: Number, default: 90 },
        deleteAfterDays: { type: Number, default: 365 }
    },
    processed: {
        indexed: { type: Boolean, default: false },
        analyzed: { type: Boolean, default: false },
        alerted: { type: Boolean, default: false },
        exported: { type: Boolean, default: false }
    }
}, {
    timestamps: true,
    // Automatically delete documents after retention period
    expireAfterSeconds: 31536000 // 365 days in seconds
});

// Compound indexes for better query performance
logSchema.index({ level: 1, category: 1, createdAt: -1 });
logSchema.index({ 'user.id': 1, createdAt: -1 });
logSchema.index({ 'device.id': 1, createdAt: -1 });
logSchema.index({ category: 1, action: 1, createdAt: -1 });
logSchema.index({ 'security.threat': 1, createdAt: -1 });
logSchema.index({ 'error.severity': 1, level: 1, createdAt: -1 });
logSchema.index({ createdAt: -1 }); // For general time-based queries
logSchema.index({ 'metadata.correlationId': 1 });

// Text index for full-text search
logSchema.index({ 
    message: 'text', 
    action: 'text', 
    'user.email': 'text',
    'device.name': 'text'
});

// Virtual for log severity score
logSchema.virtual('severityScore').get(function() {
    const levelScores = {
        'trace': 0,
        'debug': 1,
        'info': 2,
        'warn': 3,
        'error': 4,
        'fatal': 5
    };
    
    const threatScores = {
        'none': 0,
        'low': 1,
        'medium': 2,
        'high': 3,
        'critical': 4
    };
    
    const levelScore = levelScores[this.level] || 0;
    const threatScore = threatScores[this.security?.threat] || 0;
    
    return levelScore + (threatScore * 2);
});

// Virtual for formatted message with context
logSchema.virtual('formattedMessage').get(function() {
    let formatted = this.message;
    
    if (this.user?.email) {
        formatted += ` [User: ${this.user.email}]`;
    }
    
    if (this.device?.name) {
        formatted += ` [Device: ${this.device.name}]`;
    }
    
    if (this.resource?.name) {
        formatted += ` [Resource: ${this.resource.name}]`;
    }
    
    return formatted;
});

// Method to check if log should trigger alert
logSchema.methods.shouldAlert = function() {
    const alertConditions = [
        this.level === 'error' || this.level === 'fatal',
        this.security?.threat === 'high' || this.security?.threat === 'critical',
        this.error?.severity === 'high' || this.error?.severity === 'critical',
        this.security?.blocked === true
    ];
    
    return alertConditions.some(condition => condition);
};

// Method to anonymize sensitive data for exports
logSchema.methods.anonymize = function() {
    const anonymized = this.toObject();
    
    // Remove or hash sensitive fields
    if (anonymized.user?.email) {
        anonymized.user.email = anonymized.user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    }
    
    if (anonymized.user?.ipAddress) {
        const ip = anonymized.user.ipAddress.split('.');
        anonymized.user.ipAddress = `${ip[0]}.${ip[1]}.***.**`;
    }
    
    // Remove sensitive request/response data
    if (anonymized.request?.body) {
        anonymized.request.body = '[REDACTED]';
    }
    
    if (anonymized.request?.headers) {
        delete anonymized.request.headers.authorization;
        delete anonymized.request.headers.cookie;
    }
    
    return anonymized;
};

// Static method to create standardized log entry
logSchema.statics.createEntry = function(logData) {
    return this.create({
        ...logData,
        metadata: {
            ...logData.metadata,
            correlationId: logData.metadata?.correlationId || this.generateCorrelationId()
        }
    });
};

// Static method to generate correlation ID
logSchema.statics.generateCorrelationId = function() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Static method for analytics queries
logSchema.statics.getStats = function(filters = {}) {
    const pipeline = [
        { $match: filters },
        {
            $group: {
                _id: {
                    level: '$level',
                    category: '$category',
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    }
                },
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$response.duration' },
                errors: {
                    $sum: {
                        $cond: [
                            { $in: ['$level', ['error', 'fatal']] },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        { $sort: { '_id.date': -1, '_id.level': 1 } }
    ];
    
    return this.aggregate(pipeline);
};

// Static method to cleanup old logs
logSchema.statics.cleanup = function(daysOld = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    return this.deleteMany({
        createdAt: { $lt: cutoffDate },
        level: { $in: ['debug', 'trace', 'info'] }
    });
};

// Pre-save middleware to process log entry
logSchema.pre('save', function(next) {
    // Set default correlation ID if not provided
    if (!this.metadata?.correlationId) {
        this.metadata = this.metadata || {};
        this.metadata.correlationId = this.constructor.generateCorrelationId();
    }
    
    // Auto-set processed flags for high-priority logs
    if (this.shouldAlert() && !this.processed.alerted) {
        this.processed.alerted = true;
    }
    
    next();
});

module.exports = mongoose.model('Log', logSchema);