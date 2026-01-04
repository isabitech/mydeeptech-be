import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    // Invoice identification
    invoiceNumber: {
      type: String,
      required: function () {
        // Only required if document is being saved and it's not new (to allow pre-save to generate it)
        return !this.isNew;
      },
      unique: true,
      trim: true
    },

    // Project and user information
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnnotationProject",
      required: true
    },
    dtUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser",
      required: true // Admin who created the invoice
    },

    // Financial details
    invoiceAmount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      enum: ["USD", "EUR", "GBP", "NGN", "KES", "GHS"],
      default: "USD"
    },

    // Date information
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    dueDate: {
      type: Date,
      required: true
    },

    // Work period (optional)
    workPeriodStart: {
      type: Date
    },
    workPeriodEnd: {
      type: Date
    },

    // Invoice details
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    workDescription: {
      type: String,
      trim: true,
      maxlength: 2000
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "overdue", "cancelled", "disputed"],
      default: "unpaid"
    },

    // Payment details
    paidAt: {
      type: Date
    },
    paidAmount: {
      type: Number,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "paypal", "stripe", "cryptocurrency", "cash", "other"]
    },
    paymentReference: {
      type: String,
      trim: true
    },
    paymentNotes: {
      type: String,
      trim: true,
      maxlength: 500
    },

    // Work tracking
    hoursWorked: {
      type: Number,
      min: 0
    },
    tasksCompleted: {
      type: Number,
      min: 0
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100
    },

    // Status and tracking
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "paid", "overdue", "cancelled"],
      default: "draft"
    },

    // Email tracking
    emailSent: {
      type: Boolean,
      default: false
    },
    emailSentAt: {
      type: Date
    },
    lastEmailReminder: {
      type: Date
    },
    emailViewedAt: {
      type: Date
    },

    // Admin notes
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    // Invoice metadata
    invoiceType: {
      type: String,
      enum: ["project_completion", "milestone", "hourly", "fixed_rate", "bonus"],
      default: "project_completion"
    },

    // Approval workflow
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DTUser"
    },
    approvedAt: {
      type: Date
    },

    // Dispute handling
    disputedAt: {
      type: Date
    },
    disputeReason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    disputeResolvedAt: {
      type: Date
    },

    // Attachments
    attachments: [{
      fileName: String,
      fileUrl: String,
      fileType: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function () {
  if (this.paymentStatus === 'paid' || this.paymentStatus === 'cancelled') {
    return 0;
  }
  const today = new Date();
  const diffTime = today - this.dueDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for payment amount due
invoiceSchema.virtual('amountDue').get(function () {
  if (this.paymentStatus === 'paid') {
    return 0;
  }
  return this.invoiceAmount - (this.paidAmount || 0);
});

// Virtual for formatted invoice number
invoiceSchema.virtual('formattedInvoiceNumber').get(function () {
  return `INV-${this.invoiceNumber}`;
});

// Index for efficient queries
invoiceSchema.index({ dtUserId: 1, paymentStatus: 1 });
invoiceSchema.index({ projectId: 1 });
invoiceSchema.index({ createdBy: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ dueDate: 1 });

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // Find the last invoice for this month to generate sequential number
    const lastInvoice = await mongoose.model('Invoice').findOne({
      invoiceNumber: new RegExp(`^${year}${month}`)
    }).sort({ invoiceNumber: -1 });

    let sequenceNumber = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.slice(-4));
      sequenceNumber = lastSequence + 1;
    }

    this.invoiceNumber = `${year}${month}${String(sequenceNumber).padStart(4, '0')}`;
  }

  // Auto-update status based on payment status
  if (this.paymentStatus === 'paid' && this.status !== 'paid') {
    this.status = 'paid';
  }

  // Check if invoice is overdue
  if (this.paymentStatus === 'unpaid' && new Date() > this.dueDate) {
    this.paymentStatus = 'overdue';
  }

  next();
});

// Static method to get invoice statistics
invoiceSchema.statics.getInvoiceStats = async function (dtUserId, adminId = null) {
  // Ensure dtUserId is ObjectId if provided
  const matchCondition = {};
  if (dtUserId) {
    matchCondition.dtUserId = mongoose.Types.ObjectId.isValid(dtUserId)
      ? new mongoose.Types.ObjectId(dtUserId)
      : dtUserId;
  }
  if (adminId) {
    matchCondition.createdBy = mongoose.Types.ObjectId.isValid(adminId)
      ? new mongoose.Types.ObjectId(adminId)
      : adminId;
  }

  console.log(`🔍 Invoice stats match condition:`, matchCondition);

  const stats = await this.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalAmount: { $sum: '$invoiceAmount' },
        paidAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$invoiceAmount', 0]
          }
        },
        unpaidAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, '$invoiceAmount', 0]
          }
        },
        overdueAmount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, '$invoiceAmount', 0]
          }
        },
        unpaidCount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0]
          }
        },
        paidCount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0]
          }
        },
        overdueCount: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'overdue'] }, 1, 0]
          }
        }
      }
    }
  ]);

  console.log(`📊 Raw aggregation result:`, stats);

  const result = stats[0] || {
    totalInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    overdueAmount: 0,
    unpaidCount: 0,
    paidCount: 0,
    overdueCount: 0
  };

  console.log(`📈 Final stats result:`, result);
  return result;
};

// Instance method to mark as paid
invoiceSchema.methods.markAsPaid = function (paymentDetails = {}) {
  this.paymentStatus = 'paid';
  this.status = 'paid';
  this.paidAt = new Date();
  this.paidAmount = this.invoiceAmount;

  if (paymentDetails.paymentMethod) {
    this.paymentMethod = paymentDetails.paymentMethod;
  }
  if (paymentDetails.paymentReference) {
    this.paymentReference = paymentDetails.paymentReference;
  }
  if (paymentDetails.paymentNotes) {
    this.paymentNotes = paymentDetails.paymentNotes;
  }

  return this.save();
};

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;
