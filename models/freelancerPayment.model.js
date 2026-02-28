const mongoose = require('mongoose');

const freelancerPaymentSchema = new mongoose.Schema({
    // Payment identification
    paymentReference: {
        type: String,
        required: true,
        unique: true
    },
    paystackReference: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values but requires uniqueness for non-null
    },
    
    // Freelancer and project information
    freelancerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser', // Assuming freelancers are stored in DTUser model
        required: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnnotationProject',
        required: false // Made optional to support non-project payments
    },
    invoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice'
    },
    
    // Payment details
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        enum: ['NGN', 'USD', 'GHS', 'KES', 'ZAR'],
        default: 'NGN'
    },
    
    // Paystack transaction details
    paystackData: {
        authorization_url: String,
        access_code: String,
        transaction_id: String,
        gateway_response: String,
        channel: String,
        card_type: String,
        bank: String,
        fees: Number,
        vat: Number,
        transaction_date: Date
    },
    
    // Payment status tracking
    status: {
        type: String,
        enum: ['pending', 'processing', 'success', 'failed', 'abandoned', 'cancelled'],
        default: 'pending'
    },
    
    // Payment method
    paymentMethod: {
        type: String,
        enum: ['card', 'bank_transfer', 'ussd', 'qr', 'mobile_money'],
        default: 'card'
    },
    
    // Customer details
    customerEmail: {
        type: String,
        required: true,
        lowercase: true
    },
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String
    },
    
    // Transaction metadata
    description: {
        type: String,
        default: 'Freelancer service payment'
    },
    paymentType: {
        type: String,
        enum: ['freelancer_payment', 'admin_bonus', 'stakeholder_dividend', 'consultant_fee', 'general', 'other'],
        default: 'freelancer_payment'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // For additional Paystack metadata
        default: {}
    },
    
    // Webhook and verification
    webhookReceived: {
        type: Boolean,
        default: false
    },
    verificationAttempts: {
        type: Number,
        default: 0,
        max: 3
    },
    lastVerifiedAt: {
        type: Date
    },
    
    // Refund information
    isRefunded: {
        type: Boolean,
        default: false
    },
    refundAmount: {
        type: Number,
        min: 0,
        validate: {
            validator: function(value) {
                return !value || value <= this.amount;
            },
            message: 'Refund amount cannot exceed payment amount'
        }
    },
    refundReference: {
        type: String
    },
    refundedAt: {
        type: Date
    },
    
    // Audit trail
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DTUser', // Admin or system user who initiated payment
        required: true
    },
    completedAt: {
        type: Date
    },
    failedAt: {
        type: Date
    },
    failureReason: {
        type: String
    },
    
    // Additional tracking
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
    
}, {
    timestamps: true // Enable automatic timestamps for createdAt and updatedAt
});

// Indexes for better query performance
freelancerPaymentSchema.index({ freelancerId: 1, status: 1 });
freelancerPaymentSchema.index({ projectId: 1, status: 1 });
freelancerPaymentSchema.index({ status: 1, createdAt: -1 });
freelancerPaymentSchema.index({ customerEmail: 1 });
freelancerPaymentSchema.index({ paymentType: 1 });
freelancerPaymentSchema.index({ freelancerId: 1, paymentType: 1 });
freelancerPaymentSchema.index({ 'metadata.batchId': 1 });

// Pre-save middleware to generate payment reference if not provided
freelancerPaymentSchema.pre('save', function(next) {
    if (!this.paymentReference && this.isNew) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        this.paymentReference = `FLP_${timestamp}_${random}`.toUpperCase();
    }
    next();
});

// Instance methods
freelancerPaymentSchema.methods.markAsCompleted = function() {
    this.status = 'success';
    this.completedAt = new Date();
    this.webhookReceived = true;
    return this.save();
};

freelancerPaymentSchema.methods.markAsFailed = function(reason) {
    this.status = 'failed';
    this.failedAt = new Date();
    this.failureReason = reason;
    return this.save();
};

freelancerPaymentSchema.methods.updatePaystackData = function(paystackResponse) {
    this.paystackData = {
        ...this.paystackData,
        ...paystackResponse
    };
    this.paystackReference = paystackResponse.reference;
    return this.save();
};

// Static methods
freelancerPaymentSchema.statics.findByReference = function(reference) {
    return this.findOne({
        $or: [
            { paymentReference: reference },
            { paystackReference: reference }
        ]
    });
};

freelancerPaymentSchema.statics.getFreelancerPayments = function(freelancerId, status = null) {
    const query = { freelancerId };
    if (status) query.status = status;
    
    return this.find(query)
        .populate('freelancerId', 'firstName lastName email')
        .populate('projectId', 'projectName')
        .sort({ createdAt: -1 });
};

freelancerPaymentSchema.statics.getProjectPayments = function(projectId, status = null) {
    const query = { projectId };
    if (status) query.status = status;
    
    return this.find(query)
        .populate('freelancerId', 'firstName lastName email')
        .populate('projectId', 'projectName')
        .sort({ createdAt: -1 });
};

module.exports = mongoose.model('FreelancerPayment', freelancerPaymentSchema);