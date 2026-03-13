const mongoose = require('mongoose');

const hvncShiftSchema = new mongoose.Schema(
    {
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
        start_date: {
            type: Date,
            required: true,
            index: true
        },
        end_date: {
            type: Date,
            index: true
        },
        start_time: {
            type: String, // Format: "HH:mm" e.g., "09:00"
            required: true,
            validate: {
                validator: function(v) {
                    return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: 'Invalid time format. Use HH:mm (24-hour)'
            }
        },
        end_time: {
            type: String, // Format: "HH:mm" e.g., "17:00"
            required: true,
            validate: {
                validator: function(v) {
                    return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: 'Invalid time format. Use HH:mm (24-hour)'
            }
        },
        timezone: {
            type: String,
            default: 'UTC',
            required: true
        },
        is_recurring: {
            type: Boolean,
            default: false
        },
        days_of_week: [{
            type: Number,
            min: 0, // Sunday
            max: 6, // Saturday
            validate: {
                validator: function(v) {
                    return v >= 0 && v <= 6;
                },
                message: 'Day of week must be 0-6 (Sunday=0, Saturday=6)'
            }
        }], // 0=Sunday, 1=Monday, ..., 6=Saturday
        status: {
            type: String,
            enum: ['active', 'paused', 'ended', 'cancelled'],
            default: 'active',
            index: true
        },
        break_periods: [{
            start_time: {
                type: String,
                validate: {
                    validator: function(v) {
                        return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    }
                }
            },
            end_time: {
                type: String,
                validate: {
                    validator: function(v) {
                        return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    }
                }
            },
            duration_minutes: Number,
            description: String
        }],
        shift_config: {
            auto_start_hubstaff: {
                type: Boolean,
                default: true
            },
            hubstaff_project_id: String,
            hubstaff_project_name: String,
            allow_early_start_minutes: {
                type: Number,
                default: 15,
                min: 0,
                max: 60
            },
            allow_late_end_minutes: {
                type: Number,
                default: 30,
                min: 0,
                max: 120
            },
            require_approval_for_overtime: {
                type: Boolean,
                default: true
            }
        },
        notes: String,
        created_by: {
            type: String,
            ref: 'HVNCUser'
        },
        approved_by: {
            type: String,
            ref: 'HVNCUser'
        },
        approval_status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved'
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual to calculate shift duration in hours
hvncShiftSchema.virtual('duration_hours').get(function() {
    const [startHour, startMin] = this.start_time.split(':').map(Number);
    const [endHour, endMin] = this.end_time.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    
    // Handle shifts that cross midnight
    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
    }
    
    return (endMinutes - startMinutes) / 60;
});

// Virtual to check if shift is currently active
hvncShiftSchema.virtual('is_currently_active').get(function() {
    if (this.status !== 'active') return false;
    
    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0]);
    
    // Check if current date is within shift range
    if (this.start_date > today) return false;
    if (this.end_date && this.end_date < today) return false;
    
    // For recurring shifts, check day of week
    if (this.is_recurring) {
        const currentDayOfWeek = now.getDay();
        if (!this.days_of_week.includes(currentDayOfWeek)) return false;
    } else {
        // For one-time shifts, check exact date
        const startDate = new Date(this.start_date.toISOString().split('T')[0]);
        if (today.getTime() !== startDate.getTime()) return false;
    }
    
    // Check if current time is within shift hours
    return this.isTimeWithinShift(now);
});

// Virtual to get next shift occurrence
hvncShiftSchema.virtual('next_occurrence').get(function() {
    if (!this.is_recurring || this.status !== 'active') {
        return this.start_date;
    }
    
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    
    // Find the next day this shift occurs
    let daysUntilNext = 0;
    for (let i = 0; i < 7; i++) {
        const checkDay = (currentDayOfWeek + i) % 7;
        if (this.days_of_week.includes(checkDay)) {
            daysUntilNext = i;
            break;
        }
    }
    
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntilNext);
    
    const [hour, minute] = this.start_time.split(':').map(Number);
    nextDate.setHours(hour, minute, 0, 0);
    
    return nextDate;
});

// Indexes for performance
hvncShiftSchema.index({ device_id: 1, user_email: 1 });
hvncShiftSchema.index({ start_date: 1, end_date: 1 });
hvncShiftSchema.index({ user_email: 1, status: 1 });
hvncShiftSchema.index({ device_id: 1, status: 1 });
hvncShiftSchema.index({ is_recurring: 1, days_of_week: 1 });

// Instance methods
hvncShiftSchema.methods.isTimeWithinShift = function(checkTime) {
    const now = checkTime || new Date();
    const timezone = this.timezone || 'UTC';

    // Get current time in the shift's configured timezone
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === 'hour').value);
    const currentMin = parseInt(parts.find(p => p.type === 'minute').value);

    const [startHour, startMin] = this.start_time.split(':').map(Number);
    const [endHour, endMin] = this.end_time.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;
    const currentMinutes = currentHour * 60 + currentMin;
    
    // Handle shifts that cross midnight
    if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
        return currentMinutes >= startMinutes || currentMinutes <= (endMinutes - 24 * 60);
    }
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

hvncShiftSchema.methods.isWithinAccessWindow = function(checkTime) {
    const now = checkTime || new Date();
    
    if (!this.isTimeWithinShift(now)) {
        // Check if within early start window
        const earlyStartWindow = this.shift_config?.allow_early_start_minutes || 15;
        const [startHour, startMin] = this.start_time.split(':').map(Number);
        const shiftStartTime = new Date(now);
        shiftStartTime.setHours(startHour, startMin, 0, 0);
        
        const earlyStartTime = new Date(shiftStartTime.getTime() - earlyStartWindow * 60 * 1000);
        
        if (now >= earlyStartTime && now <= shiftStartTime) {
            return true;
        }
        
        // Check if within late end window
        const lateEndWindow = this.shift_config?.allow_late_end_minutes || 30;
        const [endHour, endMin] = this.end_time.split(':').map(Number);
        const shiftEndTime = new Date(now);
        shiftEndTime.setHours(endHour, endMin, 0, 0);
        
        const lateEndTime = new Date(shiftEndTime.getTime() + lateEndWindow * 60 * 1000);
        
        return now >= shiftEndTime && now <= lateEndTime;
    }
    
    return true;
};

hvncShiftSchema.methods.getRemainingTime = function() {
    if (!this.is_currently_active) {
        return 0;
    }
    
    const now = new Date();
    const [endHour, endMin] = this.end_time.split(':').map(Number);
    const shiftEndTime = new Date(now);
    shiftEndTime.setHours(endHour, endMin, 0, 0);
    
    // If end time has passed today, it means shift continues to tomorrow
    if (shiftEndTime < now) {
        shiftEndTime.setDate(shiftEndTime.getDate() + 1);
    }
    
    return Math.max(0, Math.floor((shiftEndTime - now) / (1000 * 60))); // In minutes
};

hvncShiftSchema.methods.deactivate = function(reason = 'manual') {
    this.status = 'ended';
    this.end_date = new Date();
    this.notes = (this.notes || '') + `\nDeactivated: ${reason} at ${new Date().toISOString()}`;
    
    return this.save();
};

// Static methods
hvncShiftSchema.statics.findActiveShiftsForUser = function(userEmail, deviceId = null) {
    const query = {
        user_email: userEmail.toLowerCase(),
        status: 'active',
        $or: [
            { end_date: null },
            { end_date: { $gte: new Date() } }
        ]
    };
    
    if (deviceId) {
        query.device_id = deviceId;
    }
    
    return this.find(query);
};

hvncShiftSchema.statics.findCurrentActiveShift = function(userEmail, deviceId) {
    return this.findOne({
        user_email: userEmail.toLowerCase(),
        device_id: deviceId,
        status: 'active',
        $or: [
            { end_date: null },
            { end_date: { $gte: new Date() } }
        ]
    });
};

hvncShiftSchema.statics.isUserAllowedAccess = async function(userEmail, deviceId, checkTime) {
    const now = checkTime || new Date();
    const shifts = await this.findActiveShiftsForUser(userEmail, deviceId);

    return shifts.some(shift => {
        if (shift.status !== 'active') return false;

        const timezone = shift.timezone || 'UTC';

        // Resolve current date in the shift's timezone
        const localDateStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(now); // "YYYY-MM-DD"
        const localDate = new Date(localDateStr);

        const startDate = new Date(shift.start_date.toISOString().split('T')[0]);
        if (localDate < startDate) return false;
        if (shift.end_date) {
            const endDate = new Date(shift.end_date.toISOString().split('T')[0]);
            if (localDate > endDate) return false;
        }

        // For recurring shifts, check the day of week in the shift's timezone
        if (shift.is_recurring) {
            const dayStr = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone, weekday: 'short'
            }).format(now);
            const dayOfWeek = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[dayStr];
            if (!shift.days_of_week.includes(dayOfWeek)) return false;
        } else {
            if (localDate.getTime() !== startDate.getTime()) return false;
        }

        return shift.isWithinAccessWindow(now);
    });
};

hvncShiftSchema.statics.createShift = function(shiftData) {
    const shift = new this({
        ...shiftData,
        user_email: shiftData.user_email?.toLowerCase()
    });
    
    return shift.save();
};

hvncShiftSchema.statics.getUpcomingShifts = function(userEmail, days = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    return this.find({
        user_email: userEmail.toLowerCase(),
        status: 'active',
        $or: [
            // One-time shifts in the future
            {
                is_recurring: false,
                start_date: { $gte: now, $lte: futureDate }
            },
            // Recurring shifts that are still active
            {
                is_recurring: true,
                $or: [
                    { end_date: null },
                    { end_date: { $gte: now } }
                ]
            }
        ]
    });
};

// Pre-save middleware
hvncShiftSchema.pre('save', function(next) {
    if (this.user_email) {
        this.user_email = this.user_email.toLowerCase();
    }
    
    // Validate that end_time is after start_time (unless crossing midnight)
    if (this.start_time && this.end_time) {
        const [startHour, startMin] = this.start_time.split(':').map(Number);
        const [endHour, endMin] = this.end_time.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        // Allow shifts that cross midnight, but validate reasonable duration
        if (startMinutes === endMinutes) {
            return next(new Error('Start time and end time cannot be the same'));
        }
        
        const duration = endMinutes > startMinutes ? 
            endMinutes - startMinutes : 
            (24 * 60) - startMinutes + endMinutes;
            
        if (duration > 16 * 60) { // Max 16 hour shifts
            return next(new Error('Shift duration cannot exceed 16 hours'));
        }
    }
    
    // For recurring shifts, ensure days_of_week is not empty
    if (this.is_recurring && (!this.days_of_week || this.days_of_week.length === 0)) {
        return next(new Error('Recurring shifts must have at least one day of week specified'));
    }
    
    next();
});

module.exports = mongoose.model('HVNCShift', hvncShiftSchema);