const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true, 
        trim: true 
    },
    description: { 
        type: String, 
        trim: true 
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    startTime: { 
        type: Date, 
        required: true 
    },
    endTime: { 
        type: Date, 
        required: true 
    },
    status: {
        type: String,
        enum: ['scheduled', 'active', 'completed', 'cancelled', 'no_show', 'extended'],
        default: 'scheduled'
    },
    type: {
        type: String,
        enum: ['regular', 'overtime', 'maintenance', 'training', 'remote'],
        default: 'regular'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    recurrence: {
        type: {
            type: String,
            enum: ['none', 'daily', 'weekly', 'monthly'],
            default: 'none'
        },
        interval: { 
            type: Number, 
            default: 1 
        }, // Every X days/weeks/months
        daysOfWeek: [{ 
            type: Number, 
            min: 0, 
            max: 6 
        }], // 0 = Sunday, 6 = Saturday
        endDate: { type: Date },
        maxOccurrences: { type: Number }
    },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    breakTime: {
        total: { type: Number, default: 0 }, // minutes
        breaks: [{
            startTime: { type: Date, required: true },
            endTime: { type: Date },
            duration: { type: Number }, // minutes
            reason: { type: String, trim: true }
        }]
    },
    overtime: {
        approved: { type: Boolean, default: false },
        requestedMinutes: { type: Number, default: 0 },
        actualMinutes: { type: Number, default: 0 },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: { type: Date }
    },
    location: {
        building: { type: String, trim: true },
        floor: { type: String, trim: true },
        room: { type: String, trim: true },
        isRemote: { type: Boolean, default: false }
    },
    department: { 
        type: String, 
        trim: true 
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    tasks: [{
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        status: { 
            type: String, 
            enum: ['pending', 'in_progress', 'completed'], 
            default: 'pending' 
        },
        estimatedMinutes: { type: Number },
        actualMinutes: { type: Number },
        completedAt: { type: Date }
    }],
    notes: [{
        content: { type: String, required: true, trim: true },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        createdAt: { type: Date, default: Date.now },
        isInternal: { type: Boolean, default: false }
    }],
    approval: {
        required: { type: Boolean, default: false },
        status: { 
            type: String, 
            enum: ['pending', 'approved', 'rejected'], 
            default: 'pending' 
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: { type: Date },
        rejectionReason: { type: String, trim: true }
    },
    reminders: [{
        type: { 
            type: String, 
            enum: ['email', 'notification', 'sms'], 
            required: true 
        },
        time: { type: Date, required: true },
        sent: { type: Boolean, default: false },
        message: { type: String, trim: true }
    }],
    cover: {
        isRequired: { type: Boolean, default: false },
        coverUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: { type: String, trim: true }
    },
    parentShift: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift'
    }, // For recurring shifts
    isActive: { 
        type: Boolean, 
        default: true 
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes for better performance
shiftSchema.index({ device: 1, startTime: 1 });
shiftSchema.index({ user: 1, startTime: 1 });
shiftSchema.index({ startTime: 1, endTime: 1 });
shiftSchema.index({ status: 1 });
shiftSchema.index({ 'recurrence.type': 1 });
shiftSchema.index({ department: 1 });
shiftSchema.index({ project: 1 });

// Virtual for shift duration in minutes
shiftSchema.virtual('duration').get(function() {
    if (this.endTime && this.startTime) {
        return Math.round((this.endTime - this.startTime) / (1000 * 60));
    }
    return 0;
});

// Virtual for actual duration in minutes
shiftSchema.virtual('actualDuration').get(function() {
    if (this.actualEndTime && this.actualStartTime) {
        return Math.round((this.actualEndTime - this.actualStartTime) / (1000 * 60));
    }
    return 0;
});

// Method to check if shift is currently active
shiftSchema.methods.isCurrentlyActive = function() {
    const now = new Date();
    return this.status === 'active' && 
           now >= this.startTime && 
           now <= this.endTime;
};

// Method to check if shift overlaps with another shift
shiftSchema.methods.overlapsWith = function(otherShift) {
    return this.startTime < otherShift.endTime && 
           this.endTime > otherShift.startTime;
};

// Method to calculate overtime minutes
shiftSchema.methods.calculateOvertime = function() {
    if (!this.actualEndTime || !this.endTime) return 0;
    
    const overtimeMs = Math.max(0, this.actualEndTime - this.endTime);
    return Math.round(overtimeMs / (1000 * 60));
};

// Static method to find active shifts
shiftSchema.statics.findActive = function() {
    const now = new Date();
    return this.find({
        status: 'active',
        startTime: { $lte: now },
        endTime: { $gte: now }
    }).populate('device user');
};

// Static method to find shifts by date range
shiftSchema.statics.findByDateRange = function(startDate, endDate) {
    return this.find({
        $or: [
            {
                startTime: { $gte: startDate, $lte: endDate }
            },
            {
                endTime: { $gte: startDate, $lte: endDate }
            },
            {
                startTime: { $lte: startDate },
                endTime: { $gte: endDate }
            }
        ]
    }).sort({ startTime: 1 });
};

// Pre-save middleware to validate shift times
shiftSchema.pre('save', function(next) {
    if (this.endTime <= this.startTime) {
        next(new Error('End time must be after start time'));
    }
    
    // Check for overlapping shifts for the same device
    if (this.isNew || this.isModified('startTime') || this.isModified('endTime') || this.isModified('device')) {
        this.constructor.find({
            _id: { $ne: this._id },
            device: this.device,
            status: { $in: ['scheduled', 'active'] },
            $or: [
                {
                    startTime: { $lt: this.endTime },
                    endTime: { $gt: this.startTime }
                }
            ]
        }).then(overlappingShifts => {
            if (overlappingShifts.length > 0) {
                next(new Error('Shift overlaps with existing shift for this device'));
            } else {
                next();
            }
        }).catch(err => next(err));
    } else {
        next();
    }
});

module.exports = mongoose.model('Shift', shiftSchema);