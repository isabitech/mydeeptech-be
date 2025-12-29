const mongoose = require('mongoose');

const videoReelSchema = new mongoose.Schema({
  // Basic video information
  title: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  
  // YouTube embed information
  youtubeUrl: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        // Validate YouTube embed URL format
        return /^https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]{11}(\?.*)?$/.test(v);
      },
      message: 'Invalid YouTube embed URL format'
    }
  },
  youtubeVideoId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Thumbnail information (extracted from YouTube)
  thumbnailUrl: {
    type: String,
    required: true
  },
  highResThumbnailUrl: {
    type: String,
    default: null
  },
  
  // Categorization
  niche: {
    type: String,
    required: true,
    enum: [
      'lifestyle',
      'fashion',
      'food',
      'travel',
      'fitness',
      'beauty',
      'comedy',
      'education',
      'technology',
      'music',
      'dance',
      'art',
      'pets',
      'nature',
      'business',
      'motivation',
      'diy',
      'gaming',
      'sports',
      'other'
    ]
  },
  
  // Video metadata (from YouTube API)
  duration: {
    type: Number, // in seconds
    required: true,
    min: 1,
    max: 60 // YouTube Shorts are max 60 seconds
  },
  aspectRatio: {
    type: String,
    enum: ['portrait', 'landscape', 'square'],
    default: 'portrait'
  },
  metadata: {
    viewCount: {
      type: Number,
      default: 0
    },
    likeCount: {
      type: Number,
      default: 0
    },
    publishedAt: {
      type: Date,
      default: null
    },
    channelTitle: {
      type: String,
      default: ''
    },
    tags: {
      type: [String],
      default: []
    }
  },
  
  // Upload and management info
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Usage statistics
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  
  // Assessment specific fields
  assessmentProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MultimediaAssessmentConfig'
  }],
  
  // Quality control
  isApproved: {
    type: Boolean,
    default: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DTUser',
    default: null
  },
  
  // Content tags for filtering
  tags: [{
    type: String,
    trim: true
  }],
  
  // Content warnings if any
  contentWarnings: [{
    type: String,
    enum: ['none', 'flashing_lights', 'loud_audio', 'fast_motion', 'explicit_content']
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
videoReelSchema.index({ niche: 1, isActive: 1 });
videoReelSchema.index({ uploadedBy: 1, createdAt: -1 });
videoReelSchema.index({ usageCount: -1 });
videoReelSchema.index({ isActive: 1, isApproved: 1 });
// Note: Removed cloudinaryData.publicId unique index as YouTube videos don't have Cloudinary data

// Virtual for formatted duration
videoReelSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Virtual for file size in MB
videoReelSchema.virtual('fileSizeMB').get(function() {
  return (this.metadata.fileSize / (1024 * 1024)).toFixed(2);
});

// Static method to get random reels by niche
videoReelSchema.statics.getRandomReelsByNiche = async function(niche, limit = 5, excludeIds = []) {
  const matchStage = {
    isActive: true,
    isApproved: true,
    niche: niche
  };
  
  if (excludeIds.length > 0) {
    matchStage._id = { $nin: excludeIds };
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $sample: { size: limit } },
    {
      $project: {
        title: 1,
        description: 1,
        youtubeUrl: 1,
        thumbnailUrl: 1,
        niche: 1,
        duration: 1,
        aspectRatio: 1,
        metadata: 1,
        tags: 1,
        formattedDuration: { 
          $concat: [
            { $toString: { $floor: { $divide: ['$duration', 60] } } },
            ':',
            { 
              $cond: [
                { $lt: [{ $mod: ['$duration', 60] }, 10] },
                { $concat: ['0', { $toString: { $mod: ['$duration', 60] } }] },
                { $toString: { $mod: ['$duration', 60] } }
              ]
            }
          ]
        }
      }
    }
  ]);
};

// Static method to get reels for assessment
videoReelSchema.statics.getAssessmentReels = async function(assessmentConfig, excludeUserReels = []) {
  const reelsPerNiche = assessmentConfig.videoReels.reelsPerNiche;
  const allReels = [];
  
  for (const [niche, count] of Object.entries(reelsPerNiche)) {
    const reels = await this.getRandomReelsByNiche(niche, count, excludeUserReels);
    allReels.push(...reels);
  }
  
  // Shuffle the combined array if randomization is enabled
  if (assessmentConfig.videoReels.randomizationEnabled) {
    for (let i = allReels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allReels[i], allReels[j]] = [allReels[j], allReels[i]];
    }
  }
  
  return allReels;
};

// Instance method to increment usage count
videoReelSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

// Pre-save middleware to validate video metadata
videoReelSchema.pre('save', function(next) {
  // Ensure portrait aspect ratio for reels
  if (this.aspectRatio === 'portrait' && this.metadata.resolution) {
    const [width, height] = this.metadata.resolution.split('x').map(Number);
    if (width >= height) {
      return next(new Error('Portrait videos must have height greater than width'));
    }
  }
  
  next();
});

module.exports = mongoose.model('VideoReel', videoReelSchema);