const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    deviceId: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
    },
    type: { 
        type: String, 
        required: true,
        enum: ['desktop', 'laptop', 'tablet', 'mobile', 'workstation', 'other'],
        default: 'desktop'
    },
    model: { 
        type: String, 
        trim: true 
    },
    manufacturer: { 
        type: String, 
        trim: true 
    },
    serialNumber: { 
        type: String, 
        trim: true 
    },
    operatingSystem: { 
        type: String, 
        trim: true 
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'inactive', 'maintenance'],
        default: 'offline'
    },
    lastSeen: { 
        type: Date, 
        default: Date.now 
    },
    ipAddress: { 
        type: String, 
        trim: true 
    },
    macAddress: { 
        type: String, 
        trim: true 
    },
    location: {
        building: { type: String, trim: true },
        floor: { type: String, trim: true },
        room: { type: String, trim: true },
        coordinates: {
            latitude: { type: Number },
            longitude: { type: Number }
        }
    },
    currentUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignedUsers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        assignedAt: {
            type: Date,
            default: Date.now
        },
        permissions: [{
            type: String,
            enum: ['read', 'write', 'admin', 'remote_access']
        }]
    }],
    hubstaff: {
        deviceId: { type: String },
        isActive: { type: Boolean, default: false },
        lastActivity: { type: Date },
        configuration: {
            screenshotInterval: { type: Number, default: 300 }, // seconds
            activityTracking: { type: Boolean, default: true },
            keyboardTracking: { type: Boolean, default: true },
            mouseTracking: { type: Boolean, default: true }
        }
    },
    configuration: {
        autoLock: { type: Boolean, default: true },
        lockTimeout: { type: Number, default: 900 }, // seconds
        allowRemoteAccess: { type: Boolean, default: false },
        allowFileTransfer: { type: Boolean, default: false },
        maxSessionDuration: { type: Number, default: 28800 }, // 8 hours in seconds
        allowedHours: {
            start: { type: String, default: '09:00' },
            end: { type: String, default: '17:00' }
        },
        allowedDays: [{
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }]
    },
    specifications: {
        cpu: { type: String },
        ram: { type: String },
        storage: { type: String },
        gpu: { type: String },
        resolution: { type: String }
    },
    maintenance: {
        lastMaintenance: { type: Date },
        nextMaintenance: { type: Date },
        maintenanceNotes: [{ 
            note: { type: String },
            date: { type: Date, default: Date.now },
            technician: { type: String }
        }]
    },
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
deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ currentUser: 1 });
deviceSchema.index({ 'assignedUsers.user': 1 });
deviceSchema.index({ lastSeen: -1 });
deviceSchema.index({ 'location.building': 1, 'location.floor': 1, 'location.room': 1 });

// Virtual for getting active sessions count
deviceSchema.virtual('activeSessions', {
    ref: 'UserSession',
    localField: '_id',
    foreignField: 'device',
    match: { isActive: true },
    count: true
});

// Method to check if device is currently available
deviceSchema.methods.isAvailable = function() {
    const now = new Date();
    const lastSeenThreshold = 5 * 60 * 1000; // 5 minutes
    
    return this.status === 'online' && 
           this.isActive && 
           (now - this.lastSeen) < lastSeenThreshold;
};

// Method to check if user has permission to access device
deviceSchema.methods.hasPermission = function(userId, permission) {
    const assignment = this.assignedUsers.find(
        assignment => assignment.user.toString() === userId.toString()
    );
    
    return assignment && assignment.permissions.includes(permission);
};

// Static method to find available devices
deviceSchema.statics.findAvailable = function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return this.find({
        status: 'online',
        isActive: true,
        lastSeen: { $gte: fiveMinutesAgo }
    });
};

module.exports = mongoose.model('Device', deviceSchema);