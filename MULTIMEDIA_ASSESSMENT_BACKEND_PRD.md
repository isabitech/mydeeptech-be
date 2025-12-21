# 🎬 Multimedia Assessment System - Backend PRD

## 📋 Overview
Build a comprehensive backend system for multimedia annotation assessment that enables annotators to create multi-turn conversations using video reels, with QA review capabilities and admin management.

## 🎯 Core Features Required

### 1. **User Status Enhancement**
```typescript
// Extend existing user model
{
  annotatorStatus: 'pending' | 'approved' | 'rejected',
  microTaskerStatus: 'pending' | 'approved' | 'rejected', 
  qaStatus: 'pending' | 'approved' | 'rejected', // NEW
  multimediaAssessmentStatus: 'not_started' | 'in_progress' | 'submitted' | 'under_review' | 'passed' | 'failed' // NEW
}
```

### 2. **Video Reel Management System**

#### **Video Reel Model**
```typescript
VideoReel {
  _id: ObjectId,
  title: string,
  description: string,
  videoUrl: string, // S3/Cloud storage URL
  thumbnailUrl: string, // Auto-generated thumbnail
  niche: string, // Category/niche classification
  duration: number, // in seconds
  aspectRatio: 'portrait' | 'landscape' | 'square',
  metadata: {
    resolution: string, // "1080x1920"
    fileSize: number, // in bytes
    format: string, // "mp4", "mov", etc.
  },
  uploadedBy: ObjectId, // Admin who uploaded
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### **Required Endpoints**
```
POST /admin/multimedia-assessments/reels/upload
- Bulk upload video reels with niche categorization
- Auto-generate thumbnails
- Validate video format and duration

GET /admin/multimedia-assessments/reels
- Get all reels with filtering (niche, status)
- Pagination support
- Analytics (usage count, performance)

GET /assessments/multimedia/reels
- Get randomized reels for assessment (20+ per niche)
- Filter by niche for targeted selection
- Exclude previously used reels for same user

PUT /admin/multimedia-assessments/reels/:id
- Update reel metadata
- Change active status
- Update niche classification

DELETE /admin/multimedia-assessments/reels/:id
- Soft delete with usage validation
```

### 3. **Assessment Configuration System**

#### **Assessment Config Model**
```typescript
MultimediaAssessmentConfig {
  _id: ObjectId,
  projectId: ObjectId,
  title: string,
  description: string,
  instructions: string,
  requirements: {
    tasksPerAssessment: number, // default 5
    timeLimit: number, // in minutes, default 60
    allowPausing: boolean,
    retakePolicy: {
      allowed: boolean,
      cooldownHours: number, // default 24
      maxAttempts: number
    }
  },
  videoReels: {
    totalAvailable: number,
    reelsPerNiche: { [niche: string]: number },
    randomizationEnabled: boolean
  },
  scoring: {
    passingScore: number, // default 70
    qaRequired: boolean,
    autoApprovalThreshold?: number
  },
  isActive: boolean,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### 4. **Assessment Submission System**

#### **Submission Model**
```typescript
MultimediaAssessmentSubmission {
  _id: ObjectId,
  assessmentId: ObjectId,
  annotatorId: ObjectId,
  projectId: ObjectId,
  tasks: [AssessmentTask],
  totalTimeSpent: number, // in seconds
  timerState: {
    isRunning: boolean,
    startTime: Date,
    pausedTime: number, // accumulated paused time
    totalPausedDuration: number
  },
  status: 'in_progress' | 'submitted' | 'under_review' | 'approved' | 'rejected',
  submittedAt: Date,
  qaReview?: ObjectId,
  attemptNumber: number,
  createdAt: Date,
  updatedAt: Date
}

AssessmentTask {
  taskNumber: number, // 1-5
  conversation: MultimediaConversation,
  timeSpent: number, // in seconds
  isCompleted: boolean,
  submittedAt: Date
}

MultimediaConversation {
  originalVideoId: ObjectId,
  turns: [ConversationTurn],
  totalDuration: number,
  startingPoint: 'video' | 'prompt'
}

ConversationTurn {
  turnNumber: number,
  userPrompt: string,
  aiResponse: {
    videoSegment: VideoSegment,
    responseText: string
  },
  timestamp: Date
}

VideoSegment {
  startTime: number, // in seconds
  endTime: number, // in seconds
  segmentUrl: string, // processed video segment URL
  role: 'user_prompt' | 'ai_response',
  content: string // text content for this segment
}
```

#### **Required Endpoints**
```
POST /assessments/multimedia/start
- Create new assessment session
- Generate randomized video reels
- Initialize timer state
- Return session ID and available reels

GET /assessments/multimedia/:submissionId
- Get current session state
- Return progress and timer information
- Include available reels and config

PATCH /assessments/multimedia/:submissionId/progress
- Save task progress (auto-save)
- Update timer state
- Store conversation data

POST /assessments/multimedia/:submissionId/tasks/:taskNumber/submit
- Submit individual task
- Validate task completion
- Update overall progress

POST /assessments/multimedia/:submissionId/timer
- Control timer (start/pause/resume)
- Validate timer state transitions
- Block work when paused

POST /assessments/multimedia/:submissionId/submit
- Submit final assessment
- Validate all tasks completed
- Trigger QA review process
- Send email notifications
```

### 5. **Video Processing System**

#### **Video Segmentation Service**
```typescript
// Required video processing capabilities
VideoProcessor {
  // Create video segments from timestamps
  createSegment(videoUrl: string, startTime: number, endTime: number): Promise<string>
  
  // Generate thumbnail at specific timestamp
  generateThumbnail(videoUrl: string, timestamp: number): Promise<string>
  
  // Validate video format and duration
  validateVideo(videoFile: File): Promise<VideoMetadata>
  
  // Compress/optimize videos for web
  optimizeVideo(videoUrl: string): Promise<string>
}
```

#### **Required Endpoints**
```
POST /video/segment
- Create video segment from timestamps
- Return processed segment URL
- Store segment metadata

POST /video/thumbnail
- Generate thumbnail at timestamp
- Return thumbnail URL
- Cache for performance

POST /video/validate
- Validate uploaded video
- Return metadata and duration
- Check format compatibility
```

### 6. **QA Review System**

#### **QA Review Model**
```typescript
QAReview {
  _id: ObjectId,
  submissionId: ObjectId,
  reviewerId: ObjectId,
  taskScores: [QATaskScore],
  overallScore: number, // 0-100
  feedback: string,
  decision: 'approved' | 'rejected',
  detailedComments: string,
  reviewTime: number, // in minutes
  reviewedAt: Date,
  createdAt: Date
}

QATaskScore {
  taskNumber: number,
  scores: {
    conversationQuality: number, // 0-20
    videoSegmentation: number, // 0-20  
    promptRelevance: number, // 0-20
    creativityAndCoherence: number, // 0-20
    technicalExecution: number // 0-20
  },
  individualFeedback: string,
  totalScore: number // 0-100
}
```

#### **Required Endpoints**
```
GET /qa/multimedia-assessments
- Get submissions pending QA review
- Filter by project, date, status
- Pagination and sorting

GET /qa/multimedia-assessments/:submissionId
- Get detailed submission for review
- Include all tasks and conversations
- Return video URLs and segments

POST /qa/multimedia-assessments/:submissionId/review
- Submit QA review and scores
- Update user status based on decision
- Trigger email notifications
- Handle retake eligibility

PATCH /qa/multimedia-assessments/:submissionId/review-draft
- Save review progress (draft)
- Allow partial scoring
- Resume review later

GET /qa/multimedia-assessments/statistics
- Get QA performance metrics
- Review completion rates
- Average scores and time
```

### 7. **Email Notification System**

#### **Required Email Templates**
```
1. Assessment Invitation Email
   - Sent when annotator applies to multimedia project
   - Include assessment instructions and link
   - Set expectations for time and requirements

2. Assessment Reminder Email
   - Sent if assessment not started within 24h
   - Include deadline information
   - Motivational messaging

3. Assessment Completion Email
   - Sent when assessment is submitted
   - Confirmation of submission
   - Next steps information

4. QA Review Result Email
   - Sent when QA review is completed
   - Include score and feedback
   - Approval/rejection status
   - Retake information if applicable

5. QA Assignment Email
   - Sent to QA reviewers when new submissions arrive
   - Include submission details
   - Direct link to review interface
```

#### **Required Endpoints**
```
POST /emails/assessment-invitation
- Trigger assessment invitation email
- Include personalized assessment link
- Track email delivery status

POST /emails/assessment-reminder
- Send reminder emails
- Batch process for efficiency
- Respect user preferences

POST /emails/qa-assignment
- Notify QA reviewers of new submissions
- Include priority and deadline info
- Track review assignment
```

### 8. **Analytics & Reporting System**

#### **Metrics to Track**
```typescript
AssessmentAnalytics {
  // User Performance
  completionRate: number,
  averageScore: number,
  averageTimeSpent: number,
  retakeRate: number,
  
  // Content Performance  
  videoReelUsage: { [reelId: string]: number },
  nichePerformance: { [niche: string]: PerformanceMetrics },
  
  // QA Metrics
  qaReviewTime: number,
  qaApprovalRate: number,
  qaConsistency: number,
  
  // System Performance
  assessmentStartRate: number,
  technicalIssues: number,
  userDropoffPoints: DropoffAnalysis[]
}
```

#### **Required Endpoints**
```
GET /admin/multimedia-assessments/analytics
- Comprehensive assessment analytics
- Filter by project, date range, user type
- Export capabilities

GET /admin/multimedia-assessments/analytics/reels
- Video reel performance metrics
- Usage statistics per reel
- Quality feedback correlation

GET /admin/multimedia-assessments/analytics/qa
- QA reviewer performance
- Review time and consistency metrics
- Decision quality analysis
```

### 9. **Permission & Access Control**

#### **Role-Based Access**
```typescript
Permissions {
  // Annotator Permissions
  'multimedia_assessment.take': boolean,
  'multimedia_assessment.view_results': boolean,
  'multimedia_assessment.retake': boolean,
  
  // QA Permissions
  'qa_review.access_dashboard': boolean,
  'qa_review.review_submissions': boolean,
  'qa_review.approve_reject': boolean,
  'qa_review.view_analytics': boolean,
  
  // Admin Permissions
  'multimedia_admin.manage_reels': boolean,
  'multimedia_admin.configure_assessments': boolean,
  'multimedia_admin.view_all_analytics': boolean,
  'multimedia_admin.manage_qa_reviewers': boolean
}
```

### 10. **Performance & Scalability Requirements**

#### **Technical Requirements**
- **Video Storage**: S3/CloudFront for optimal delivery
- **Video Processing**: Queue-based processing for segments
- **Real-time Updates**: WebSocket for timer and progress
- **Caching**: Redis for video metadata and thumbnails
- **Database**: Efficient indexing for video queries
- **CDN**: Global video delivery optimization

#### **Performance Targets**
- Video loading: < 3 seconds
- Segment creation: < 30 seconds
- Assessment save: < 1 second
- QA dashboard load: < 2 seconds
- Concurrent users: 100+ simultaneous assessments

## 🚀 Implementation Priority

### Phase 1 (Core Infrastructure)
1. User status enhancement (qaStatus)
2. Video reel model and basic CRUD
3. Assessment configuration system
4. Basic assessment session management

### Phase 2 (Assessment Engine)
1. Video processing and segmentation
2. Multi-turn conversation storage
3. Timer management system
4. Task submission workflow

### Phase 3 (QA System)
1. QA review model and endpoints
2. Scoring system implementation
3. Decision workflow and status updates
4. Email notification system

### Phase 4 (Advanced Features)
1. Analytics and reporting
2. Performance optimization
3. Advanced video processing
4. Comprehensive testing

## 📊 Database Considerations

### Indexing Strategy
```javascript
// Critical indexes for performance
db.videoReels.createIndex({ niche: 1, isActive: 1 })
db.videoReels.createIndex({ uploadedBy: 1, createdAt: -1 })
db.multimediaAssessmentSubmissions.createIndex({ annotatorId: 1, status: 1 })
db.multimediaAssessmentSubmissions.createIndex({ projectId: 1, submittedAt: -1 })
db.qaReviews.createIndex({ reviewerId: 1, reviewedAt: -1 })
db.qaReviews.createIndex({ submissionId: 1 }, { unique: true })
```

### Data Retention Policy
- Keep assessment submissions for 2 years
- Archive video segments after 1 year
- Maintain analytics summaries indefinitely
- Soft delete with 30-day recovery window

This comprehensive backend system will enable the complete multimedia assessment workflow from video management through QA review and final approval. The architecture supports scalability, performance, and the complex requirements of multimedia annotation assessment.