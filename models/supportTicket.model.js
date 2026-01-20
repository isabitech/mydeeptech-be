const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  // Ticket identification
  ticketNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Chat ticket flag
  isChat: {
    type: Boolean,
    default: false
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['User', 'DTUser']
  },
  
  // Ticket details
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'technical_issue',
      'account_problem', 
      'payment_inquiry',
      'project_question',
      'assessment_issue',
      'application_help',
      'general_inquiry',
      'bug_report',
      'feature_request',
      'other'
    ]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'],
    default: 'open'
  },
  
  // Admin assignment and handling
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  
  // File attachments
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Conversation/Messages
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'messages.senderModel'
    },
    senderModel: {
      type: String,
      required: true,
      enum: ['User', 'DTUser', 'Admin']
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000
    },
    isAdminReply: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    attachments: [{
      fileName: String,
      fileUrl: String,
      fileType: String
    }]
  }],
  
  // Resolution information
  resolution: {
    summary: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DTUser'
    },
    resolvedAt: Date,
    resolutionCategory: {
      type: String,
      enum: ['solved', 'duplicate', 'cannot_reproduce', 'not_applicable', 'escalated']
    }
  },
  
  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  userSatisfactionRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  internalNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DTUser'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  
  // Auto-close functionality
  autoCloseAt: {
    type: Date,
    default: null
  },
  
  // Response time tracking
  firstResponseAt: {
    type: Date,
    default: null
  },
  responseTimeMinutes: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

// Auto-generate ticket number as fallback (timestamp + random)
supportTicketSchema.pre('save', function(next) {
  if (this.isNew && !this.ticketNumber) {
    console.log('⚠️ Generating fallback ticket number in model...');
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.ticketNumber = `TKT-${timestamp}-${random}`;
    console.log(`🎫 Fallback ticket number: ${this.ticketNumber}`);
  }
  
  // Always update lastUpdated
  this.lastUpdated = Date.now();
  next();
});

// Update last updated when messages are added
supportTicketSchema.pre('save', function(next) {
  if (this.isModified('messages') && this.messages.length > 0) {
    const latestMessage = this.messages[this.messages.length - 1];
    if (latestMessage.isAdminReply && !this.firstResponseAt) {
      this.firstResponseAt = latestMessage.timestamp;
      this.responseTimeMinutes = Math.round((this.firstResponseAt - this.createdAt) / (1000 * 60));
    }
  }
  next();
});

// Indexes for better performance
supportTicketSchema.index({ userId: 1 });
supportTicketSchema.index({ ticketNumber: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ category: 1 });
supportTicketSchema.index({ priority: 1 });
supportTicketSchema.index({ assignedTo: 1 });
supportTicketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);