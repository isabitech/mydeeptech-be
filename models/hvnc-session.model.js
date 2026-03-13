const mongoose = require('mongoose');

const hvncSessionSchema = new mongoose.Schema(
    {
        session_id: {
            type: String,
            required: true,
            unique: true,
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
        started_at: {
            type: Date,
            required: true,
            default: Date.now,
            index: true
        },
        ended_at: {
            type: Date,
            index: true
        },
        duration_minutes: {
            type: Number,
            min: 0
        },
        ip_address: {
            type: String,
            validate: {
                validator: function(v) {
                    if (!v) return true; // Allow empty
                    // IPv4 pattern
                    const ipv4Pattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
                    // IPv6 pattern (simplified)
                    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
                    return ipv4Pattern.test(v) || ipv6Pattern.test(v);
                },
                message: 'Invalid IP address format'
            }
        },
        last_activity: {
            type: Date,
            default: Date.now,
            index: true
        },
        status: {
            type: String,
            enum: ['active', 'idle', 'ended', 'timeout', 'disconnected'],
            default: 'active',
            index: true
        },
        end_reason: {
            type: String,
            enum: [
                'user_logout',
                'timeout',
                'admin_disconnect',
                'shift_ended',
                'device_offline',
                'idle_timeout',
                'system_shutdown'
            ]
        },
        access_code_used: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HVNCAccessCode'
        },
        hubstaff_session: {
            project_id: String,
            project_name: String,
            timer_started_at: Date,
            timer_ended_at: Date,
            total_minutes: Number,
            is_timer_running: {
                type: Boolean,
                default: false
            }
        },
        commands_executed: {
            type: Number,
            default: 0
        },
        chrome_interactions: {
            type: Number,
            default: 0
        },
        keyboard_events: {
            type: Number,
            default: 0
        },
        mouse_events: {
            type: Number,
            default: 0
        },
        activity_summary: {
            urls_visited: [String],
            applications_used: [String],
            total_keystrokes: Number,
            total_mouse_clicks: Number,
            idle_periods: [{
                start: Date,
                end: Date,
                duration_minutes: Number
            }]
        },
        settings: {
            idle_timeout_minutes: {
                type: Number,
                default: 30
            },
            max_duration_hours: {
                type: Number,
                default: 8
            },
            auto_hubstaff_timer: {
                type: Boolean,
                default: true
            }
        },
        connection_quality: {
            latency_ms: Number,
            packet_loss: Number,
            last_measured: Date
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual to check if session is active
hvncSessionSchema.virtual('is_active').get(function() {
    return this.status === 'active' && !this.ended_at;
});

// Virtual to check if session has timed out
hvncSessionSchema.virtual('is_timed_out').get(function() {
    if (!this.is_active) return false;
    
    const timeoutMs = (this.settings.idle_timeout_minutes || 30) * 60 * 1000;
    const timeoutThreshold = new Date(Date.now() - timeoutMs);
    
    return this.last_activity < timeoutThreshold;
});

// Virtual to get current session duration
hvncSessionSchema.virtual('current_duration_minutes').get(function() {
    const endTime = this.ended_at || new Date();
    return Math.floor((endTime - this.started_at) / (1000 * 60));
});

// Virtual to check if session has exceeded max duration
hvncSessionSchema.virtual('has_exceeded_max_duration').get(function() {
    const maxDurationMs = (this.settings.max_duration_hours || 8) * 60 * 60 * 1000;
    const currentDuration = (this.ended_at || new Date()) - this.started_at;
    
    return currentDuration > maxDurationMs;
});

// Indexes for performance
hvncSessionSchema.index({ device_id: 1, user_email: 1 });
hvncSessionSchema.index({ status: 1, started_at: 1 });
hvncSessionSchema.index({ last_activity: 1 });
hvncSessionSchema.index({ session_id: 1, status: 1 });

// Instance methods
hvncSessionSchema.methods.updateActivity = function(activityType = 'general') {
    this.last_activity = new Date();
    
    if (this.status === 'idle') {
        this.status = 'active';
    }
    
    // Update activity counters
    switch (activityType) {
        case 'command':
            this.commands_executed += 1;
            break;
        case 'chrome_navigation':
            this.chrome_interactions += 1;
            break;
        case 'mouse':
            this.mouse_events += 1;
            break;
        case 'keyboard':
            this.keyboard_events += 1;
            break;
    }
    
    return this.save();
};

hvncSessionSchema.methods.markIdle = function() {
    if (this.status === 'active') {
        this.status = 'idle';
        
        // Record idle period
        if (!this.activity_summary.idle_periods) {
            this.activity_summary.idle_periods = [];
        }
        
        this.activity_summary.idle_periods.push({
            start: new Date(),
            duration_minutes: 0 // Will be calculated on activity resume
        });
    }
    
    return this.save();
};

hvncSessionSchema.methods.endSession = function(reason = 'user_logout') {
    if (this.ended_at) {
        return this; // Already ended
    }
    
    this.ended_at = new Date();
    this.status = 'ended';
    this.end_reason = reason;
    this.duration_minutes = this.current_duration_minutes;
    
    // End any running Hubstaff timer
    if (this.hubstaff_session?.is_timer_running) {
        this.hubstaff_session.timer_ended_at = new Date();
        this.hubstaff_session.is_timer_running = false;
        this.hubstaff_session.total_minutes = Math.floor(
            (this.hubstaff_session.timer_ended_at - this.hubstaff_session.timer_started_at) / (1000 * 60)
        );
    }
    
    // Close any open idle periods
    if (this.activity_summary.idle_periods) {
        this.activity_summary.idle_periods.forEach(period => {
            if (!period.end) {
                period.end = new Date();
                period.duration_minutes = Math.floor((period.end - period.start) / (1000 * 60));
            }
        });
    }
    
    return this.save();
};

hvncSessionSchema.methods.updateHubstaffStatus = function(hubstaffData) {
    if (!this.hubstaff_session) {
        this.hubstaff_session = {};
    }
    
    this.hubstaff_session = {
        ...this.hubstaff_session,
        ...hubstaffData,
        last_updated: new Date()
    };
    
    return this.save();
};

hvncSessionSchema.methods.addUrlVisit = function(url) {
    if (!this.activity_summary.urls_visited) {
        this.activity_summary.urls_visited = [];
    }
    
    // Add unique URLs only
    if (!this.activity_summary.urls_visited.includes(url)) {
        this.activity_summary.urls_visited.push(url);
    }
    
    return this.save();
};

// Static methods
hvncSessionSchema.statics.createSession = async function(deviceId, userEmail, accessCodeId, ipAddress) {
    const sessionId = `sess_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    
    const session = new this({
        session_id: sessionId,
        device_id: deviceId,
        user_email: userEmail.toLowerCase(),
        ip_address: ipAddress,
        access_code_used: accessCodeId,
        started_at: new Date()
    });
    
    return session.save();
};

hvncSessionSchema.statics.findActiveSessions = function() {
    return this.find({
        status: { $in: ['active', 'idle'] },
        ended_at: { $exists: false }
    });
};

hvncSessionSchema.statics.findActiveSessionsForDevice = function(deviceId) {
    return this.find({
        device_id: deviceId,
        status: { $in: ['active', 'idle'] },
        ended_at: { $exists: false }
    });
};

hvncSessionSchema.statics.findActiveSessionsForUser = function(userEmail) {
    return this.find({
        user_email: userEmail.toLowerCase(),
        status: { $in: ['active', 'idle'] },
        ended_at: { $exists: false }
    });
};

hvncSessionSchema.statics.endTimedOutSessions = async function() {
    const sessions = await this.findActiveSessions();
    const timedOutSessions = sessions.filter(session => session.is_timed_out);
    
    const results = await Promise.all(
        timedOutSessions.map(session => session.endSession('idle_timeout'))
    );
    
    return results;
};

hvncSessionSchema.statics.getSessionStats = function(startDate, endDate) {
    const matchStage = {
        started_at: {
            $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            $lte: endDate || new Date()
        }
    };
    
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                total_sessions: { $sum: 1 },
                avg_duration_minutes: { $avg: '$duration_minutes' },
                total_commands: { $sum: '$commands_executed' },
                unique_users: { $addToSet: '$user_email' },
                unique_devices: { $addToSet: '$device_id' }
            }
        },
        {
            $addFields: {
                unique_user_count: { $size: '$unique_users' },
                unique_device_count: { $size: '$unique_devices' }
            }
        }
    ]);
};

// Pre-save middleware
hvncSessionSchema.pre('save', function(next) {
    if (this.user_email) {
        this.user_email = this.user_email.toLowerCase();
    }
    
    // Calculate duration if session is ended
    if (this.ended_at && !this.duration_minutes) {
        this.duration_minutes = Math.floor((this.ended_at - this.started_at) / (1000 * 60));
    }
    
    next();
});

module.exports = mongoose.model('HVNCSession', hvncSessionSchema);