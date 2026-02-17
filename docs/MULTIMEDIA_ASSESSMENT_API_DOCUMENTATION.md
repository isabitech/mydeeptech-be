# Multimedia Assessment System API Documentation

## Overview

The Multimedia Assessment System enables the creation, management, and evaluation of video-based assessments for annotator qualification. This system integrates Instagram-style video reels with multi-turn conversation creation tasks, comprehensive QA review workflows, and detailed analytics.

## Base URL

```
Production: https://api.mydeeptech.ng
Development: http://localhost:4000
```

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### User Roles
- **Admin**: Full system access including project management and assessment configuration
- **QA Reviewer**: Access to review submissions and score assessments
- **Annotator**: Access to take assessments and view results

---

## Video Reel Management

### Add Video Reel from YouTube Shorts
**Admin Only**

```http
POST /api/admin/multimedia-assessments/reels/add
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "youtubeUrl": "https://www.youtube.com/embed/VIDEO_ID", // Required: YouTube embed URL
  "title": "String (optional)", // Auto-extracted from YouTube if not provided
  "description": "String (optional)", // Auto-extracted from YouTube if not provided
  "niche": "String", // Required: technology, lifestyle, education, etc.
  "tags": ["tag1", "tag2"], // Optional array
  "contentWarnings": ["none"] // Optional: none, flashing_lights, loud_audio, etc.
}
```

**Supported YouTube URL Formats:**
The system accepts these formats and automatically converts them to embed URLs:
- `https://www.youtube.com/embed/VIDEO_ID` (preferred)
- `https://www.youtube.com/shorts/VIDEO_ID` (auto-converted)
- `https://youtu.be/VIDEO_ID` (auto-converted)
- `https://www.youtube.com/watch?v=VIDEO_ID` (auto-converted)

**Response:**
```json
{
  "success": true,
  "message": "Video reel added successfully",
  "data": {
    "videoReel": {
      "_id": "64f7a1b2e8c9d4567890abcd",
      "title": "Tech Tutorial Clip",
      "youtubeUrl": "https://www.youtube.com/embed/VIDEO_ID",
      "youtubeVideoId": "VIDEO_ID",
      "thumbnailUrl": "https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg",
      "highResThumbnailUrl": "https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg",
      "niche": "technology",
      "duration": 45,
      "aspectRatio": "portrait",
      "metadata": {
        "viewCount": 1000,
        "likeCount": 50,
        "publishedAt": "2024-01-01T00:00:00.000Z",
        "channelTitle": "Channel Name",
        "tags": ["javascript", "tutorial"]
      },
      "usageCount": 0,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Bulk Add Video Reels from YouTube URLs
**Admin Only**

```http
POST /api/admin/multimedia-assessments/reels/bulk-add
Content-Type: application/json
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "youtubeUrls": [
    "https://www.youtube.com/embed/VIDEO_ID_1",
    "https://www.youtube.com/shorts/VIDEO_ID_2",
    "https://youtu.be/VIDEO_ID_3"
  ],
  "defaultNiche": "technology",
  "defaultTags": ["assessment", "bulk-import"]
}
```

**Note**: The system accepts various YouTube URL formats and automatically converts them to embed URLs for CORS compatibility.

**Response:**
```json
{
  "success": true,
  "message": "Bulk add completed: 2 added, 1 failed",
  "data": {
    "successful": [
      {
        "id": "64f7a1b2e8c9d4567890abcd",
        "title": "Video Title 1",
        "niche": "technology",
        "duration": 30,
        "youtubeUrl": "https://www.youtube.com/embed/VIDEO_ID_1"
      }
    ],
    "failed": [
      {
        "url": "https://youtu.be/VIDEO_ID_3",
        "error": "Video not found or private"
      }
    ],
    "summary": {
      "total": 3,
      "successful": 2,
      "failed": 1
    }
  }
}
```

### Get All Video Reels
**Admin Only**

```http
GET /api/admin/multimedia-assessments/reels?page=1&limit=20&niche=technology&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `niche`: Filter by niche category
- `sortBy`: Sort field (createdAt, usageCount, title)
- `sortOrder`: asc or desc (default: desc)
- `search`: Search in title or description
- `isActive`: Filter by active status (true/false)

**Response:**
```json
{
  "success": true,
  "data": {
    "videoReels": [
      {
        "_id": "64f7a1b2e8c9d4567890abcd",
        "title": "Tech Tutorial Clip",
        "youtubeUrl": "https://www.youtube.com/shorts/VIDEO_ID",
        "thumbnailUrl": "https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg",
        "niche": "technology",
        "duration": 45,
        "usageCount": 12,
        "isActive": true,
        "isApproved": true,
        "metadata": {
          "viewCount": 1000,
          "channelTitle": "Tech Channel"
        },
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 87,
      "itemsPerPage": 20,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Update Video Reel
**Admin Only**

```http
PUT /api/admin/multimedia-assessments/reels/:reelId
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "niche": "education",
  "tags": ["tutorial", "beginner"],
  "contentWarnings": ["none"],
  "isActive": true,
  "isApproved": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video reel updated successfully",
  "data": {
    "videoReel": {
      "_id": "64f7a1b2e8c9d4567890abcd",
      "title": "Updated Title",
      "description": "Updated description",
      "niche": "education",
      "updatedAt": "2024-01-15T10:35:00Z"
    }
  }
}
```

### Delete Video Reel
**Admin Only**

```http
DELETE /api/admin/multimedia-assessments/reels/:reelId
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Video reel deleted successfully"
}
```

---

## Assessment Configuration Management

### Create Assessment Configuration
**Admin Only**

```http
POST /api/admin/assessments/config
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "title": "Multimedia Annotation Assessment",
  "description": "Comprehensive assessment for multimedia annotation skills",
  "projectId": "64f7a1b2e8c9d4567890abcd",
  "numberOfTasks": 5,
  "estimatedDuration": 60,
  "timeLimit": 90,
  "requirements": {
    "allowPausing": true,
    "requireAllTasks": true,
    "randomizeReels": true
  },
  "scoringWeights": {
    "conversationQuality": 40,
    "creativityAndEngagement": 25,
    "technicalAccuracy": 20,
    "timeManagement": 15
  },
  "passingScore": 7.0,
  "maxRetries": 3,
  "retakeCooldownHours": 24,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment configuration created successfully",
  "data": {
    "assessment": {
      "id": "64f7a1b2e8c9d4567890abcd",
      "title": "Multimedia Annotation Assessment",
      "projectId": "64f7a1b2e8c9d4567890abcd",
      "numberOfTasks": 5,
      "estimatedDuration": 60,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Get Assessment Configurations
**Admin Only**

```http
GET /api/admin/assessments/config?projectId=64f7a1b2e8c9d4567890abcd&isActive=true
Authorization: Bearer <admin_token>
```

### Update Assessment Configuration
**Admin Only**

```http
PATCH /api/admin/assessments/config/:assessmentId
Authorization: Bearer <admin_token>
```

---

## Project Assessment Integration

### Attach Assessment to Project
**Admin Only**

```http
POST /api/admin/projects/:projectId/assessment
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "assessmentId": "64f7a1b2e8c9d4567890abcd",
  "isRequired": true,
  "assessmentInstructions": "Complete this assessment to qualify for the multimedia annotation project."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment attached to project successfully",
  "data": {
    "project": {
      "id": "64f7a1b2e8c9d4567890abcd",
      "name": "Instagram Reel Annotation Project",
      "assessment": {
        "isRequired": true,
        "assessmentId": "64f7a1b2e8c9d4567890abcd",
        "assessmentInstructions": "Complete this assessment...",
        "attachedAt": "2024-01-15T10:30:00Z"
      }
    }
  }
}
```

### Remove Assessment from Project
**Admin Only**

```http
DELETE /api/admin/projects/:projectId/assessment
Authorization: Bearer <admin_token>
```

### Get Available Assessments
**Admin Only**

```http
GET /api/admin/assessments/available
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assessments": [
      {
        "id": "64f7a1b2e8c9d4567890abcd",
        "title": "Multimedia Annotation Assessment",
        "description": "Comprehensive assessment...",
        "numberOfTasks": 5,
        "estimatedDuration": 60,
        "usageCount": 15,
        "approvalRate": 78.5,
        "isActive": true,
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

## Assessment Session Management (Annotator)

### Start Assessment Session
**Annotator Only**

```http
POST /api/assessments/multimedia/:assessmentId/start
Authorization: Bearer <annotator_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment session started successfully",
  "data": {
    "submission": {
      "id": "64f7a1b2e8c9d4567890abcd",
      "assessmentId": "64f7a1b2e8c9d4567890abcd",
      "status": "in_progress",
      "tasks": [
        {
          "taskNumber": 1,
          "type": "conversation",
          "selectedReels": [
            {
              "reelId": "64f7a1b2e8c9d4567890abcd",
              "youtubeUrl": "https://www.youtube.com/shorts/VIDEO_ID",
              "thumbnailUrl": "https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg"
            }
          ],
          "isCompleted": false
        }
      ],
      "timeLimit": 90,
      "startedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Get Assessment Session
**Annotator Only**

```http
GET /api/assessments/multimedia/session/:submissionId
Authorization: Bearer <annotator_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "64f7a1b2e8c9d4567890abcd",
      "assessmentTitle": "Multimedia Annotation Assessment",
      "status": "in_progress",
      "timeRemaining": 4500000,
      "currentTask": 2,
      "totalTasks": 5,
      "completedTasks": 1,
      "tasks": [
        {
          "taskNumber": 1,
          "type": "conversation",
          "isCompleted": true,
          "score": 8.5,
          "conversation": {
            "turns": [
              {
                "speaker": "user",
                "message": "What's happening in this video?",
                "timestamp": "2024-01-15T10:32:00Z"
              },
              {
                "speaker": "assistant",
                "message": "This video shows a person demonstrating a coding technique...",
                "timestamp": "2024-01-15T10:32:15Z"
              }
            ]
          }
        }
      ],
      "timerState": {
        "isRunning": true,
        "totalTimeSpent": 900000,
        "lastStartTime": "2024-01-15T10:30:00Z"
      }
    }
  }
}
```

### Save Task Progress
**Annotator Only**

```http
POST /api/assessments/multimedia/:submissionId/save-progress
Authorization: Bearer <annotator_token>
```

**Request Body:**
```json
{
  "taskNumber": 2,
  "conversation": {
    "turns": [
      {
        "speaker": "user",
        "message": "What's the main topic of this video?",
        "timestamp": "2024-01-15T10:35:00Z"
      },
      {
        "speaker": "assistant", 
        "message": "The video focuses on advanced JavaScript techniques...",
        "timestamp": "2024-01-15T10:35:20Z"
      }
    ]
  },
  "notes": "Added initial conversation structure"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Progress saved successfully",
  "data": {
    "taskNumber": 2,
    "lastSaved": "2024-01-15T10:35:30Z",
    "timeSpent": 300000
  }
}
```

### Submit Task
**Annotator Only**

```http
POST /api/assessments/multimedia/:submissionId/submit-task
Authorization: Bearer <annotator_token>
```

**Request Body:**
```json
{
  "taskNumber": 2,
  "conversation": {
    "turns": [
      {
        "speaker": "user",
        "message": "What's the main topic of this video?",
        "timestamp": "2024-01-15T10:35:00Z"
      },
      {
        "speaker": "assistant",
        "message": "The video demonstrates advanced JavaScript array methods like map, filter, and reduce...",
        "timestamp": "2024-01-15T10:35:20Z"
      },
      {
        "speaker": "user",
        "message": "Can you explain the reduce method more?",
        "timestamp": "2024-01-15T10:36:00Z"
      },
      {
        "speaker": "assistant",
        "message": "Reduce is a powerful method that processes array elements to produce a single result...",
        "timestamp": "2024-01-15T10:36:15Z"
      }
    ]
  },
  "videoSegments": [
    {
      "startTime": 5,
      "endTime": 25,
      "description": "Explains array methods overview"
    },
    {
      "startTime": 25,
      "endTime": 45,
      "description": "Focuses on reduce method implementation"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task submitted successfully",
  "data": {
    "taskNumber": 2,
    "score": 8.7,
    "isCompleted": true,
    "submittedAt": "2024-01-15T10:38:00Z",
    "feedback": {
      "conversationQuality": "Excellent natural flow and engagement",
      "technicalAccuracy": "Accurate technical explanations",
      "creativity": "Good use of follow-up questions"
    }
  }
}
```

### Control Timer
**Annotator Only**

```http
POST /api/assessments/multimedia/:submissionId/timer
Authorization: Bearer <annotator_token>
```

**Request Body:**
```json
{
  "action": "pause" // "start", "pause", "resume"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Timer paused successfully",
  "data": {
    "timerState": {
      "isRunning": false,
      "totalTimeSpent": 1200000,
      "timeRemaining": 3900000,
      "lastPausedAt": "2024-01-15T10:40:00Z"
    }
  }
}
```

### Submit Final Assessment
**Annotator Only**

```http
POST /api/assessments/multimedia/:submissionId/submit
Authorization: Bearer <annotator_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment submitted successfully",
  "data": {
    "submissionId": "64f7a1b2e8c9d4567890abcd",
    "submittedAt": "2024-01-15T11:15:00Z",
    "totalTimeSpent": "45 minutes 30 seconds",
    "completedTasks": 5,
    "status": "submitted",
    "nextSteps": {
      "qaReview": "Your submission will be reviewed by our QA team",
      "estimatedReviewTime": "2-3 business days",
      "notificationMethod": "You will receive an email once review is complete"
    }
  }
}
```

### Get Available Reels
**Annotator Only**

```http
GET /api/assessments/multimedia/reels/:assessmentId?niche=technology&limit=10
Authorization: Bearer <annotator_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reels": [
      {
        "_id": "64f7a1b2e8c9d4567890abcd",
        "title": "JavaScript Tutorial",
        "youtubeUrl": "https://www.youtube.com/shorts/VIDEO_ID",
        "thumbnailUrl": "https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg",
        "niche": "technology",
        "duration": 45,
        "aspectRatio": "portrait"
      }
    ],
    "totalAvailable": 25,
    "usedReelsCount": 3
  }
}
```

---

## QA Review System

### Get Pending Submissions
**QA Reviewer Only**

```http
GET /api/qa/submissions/pending?page=1&limit=20&sortBy=submittedAt&filterBy=priority
Authorization: Bearer <qa_token>
```

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `sortBy`: submittedAt, avgScore, waitingTime
- `sortOrder`: asc or desc
- `filterBy`: all, priority, recent, retakes

**Response:**
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "userId": "64f7a1b2e8c9d4567890abcd",
        "userName": "John Smith",
        "userEmail": "john@example.com",
        "assessmentTitle": "Multimedia Annotation Assessment",
        "submittedAt": "2024-01-15T11:15:00Z",
        "avgScore": 8.2,
        "completionTime": 2730000,
        "waitingTime": 7200000,
        "attemptNumber": 1,
        "tasksCompleted": 5,
        "totalTasks": 5,
        "status": "submitted"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 47,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Get Submission for Review
**QA Reviewer Only**

```http
GET /api/qa/submissions/:submissionId/review
Authorization: Bearer <qa_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "64f7a1b2e8c9d4567890abcd",
      "userId": {
        "name": "John Smith",
        "email": "john@example.com"
      },
      "assessmentId": {
        "title": "Multimedia Annotation Assessment",
        "scoringWeights": {
          "conversationQuality": 40,
          "creativityAndEngagement": 25,
          "technicalAccuracy": 20,
          "timeManagement": 15
        }
      },
      "tasks": [
        {
          "taskNumber": 1,
          "type": "conversation",
          "score": 8.5,
          "conversation": {
            "turns": [
              {
                "speaker": "user",
                "message": "What's happening in this video?",
                "timestamp": "2024-01-15T10:32:00Z"
              }
            ]
          },
          "selectedReels": [
            {
              "youtubeUrl": "https://www.youtube.com/shorts/VIDEO_ID",
              "thumbnailUrl": "https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg"
            }
          ],
          "timeSpent": 600000
        }
      ],
      "metrics": {
        "totalScore": 42.5,
        "averageScore": 8.5,
        "completionTime": 2730000,
        "tasksCompleted": 5,
        "conversationsCreated": 5
      }
    },
    "qaReview": null,
    "isReviewed": false
  }
}
```

### Review Individual Task
**QA Reviewer Only**

```http
POST /api/qa/submissions/review-task
Authorization: Bearer <qa_token>
```

**Request Body:**
```json
{
  "submissionId": "64f7a1b2e8c9d4567890abcd",
  "taskIndex": 0,
  "score": 8.5,
  "feedback": "Excellent conversation flow with natural progression and engaging questions.",
  "qualityRating": "Excellent",
  "notes": "Demonstrates strong understanding of video content and creates meaningful dialogue."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task reviewed successfully",
  "data": {
    "taskReview": {
      "taskIndex": 0,
      "score": 8.5,
      "feedback": "Excellent conversation flow...",
      "qualityRating": "Excellent",
      "reviewedAt": "2024-01-15T15:30:00Z"
    },
    "totalTasksReviewed": 3
  }
}
```

### Submit Final Review
**QA Reviewer Only**

```http
POST /api/qa/submissions/final-review
Authorization: Bearer <qa_token>
```

**Request Body:**
```json
{
  "submissionId": "64f7a1b2e8c9d4567890abcd",
  "overallScore": 8.3,
  "overallFeedback": "Strong performance across all tasks with excellent conversation creation skills. Minor improvements needed in technical accuracy.",
  "decision": "Approve",
  "privateNotes": "Candidate shows great potential for multimedia annotation work."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assessment approved successfully",
  "data": {
    "decision": "Approve",
    "overallScore": 8.3,
    "submissionStatus": "approved",
    "userStatus": "approved",
    "emailSent": true
  }
}
```

### Get QA Dashboard
**QA Reviewer Only**

```http
GET /api/qa/dashboard
Authorization: Bearer <qa_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalReviews": 156,
      "approvalRate": 73.1,
      "pendingReviews": 8,
      "decisionBreakdown": [
        { "_id": "Approve", "count": 114, "avgScore": 8.2 },
        { "_id": "Reject", "count": 32, "avgScore": 4.8 },
        { "_id": "Request Revision", "count": 10, "avgScore": 6.5 }
      ]
    },
    "recentReviews": [
      {
        "submissionId": "64f7a1b2e8c9d4567890abcd",
        "userName": "John Smith",
        "assessmentTitle": "Multimedia Annotation Assessment",
        "decision": "Approve",
        "overallScore": 8.3,
        "completedAt": "2024-01-15T15:30:00Z"
      }
    ]
  }
}
```

### Batch Process Submissions
**QA Reviewer Only**

```http
POST /api/qa/submissions/batch-review
Authorization: Bearer <qa_token>
```

**Request Body:**
```json
{
  "submissionIds": [
    "64f7a1b2e8c9d4567890abcd",
    "64f7a1b2e8c9d4567890abce"
  ],
  "decision": "Approve",
  "overallFeedback": "Batch approved - meets quality standards"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch processing completed. 2 processed, 0 failed.",
  "data": {
    "processed": 2,
    "failed": 0,
    "errors": []
  }
}
```

---

## Analytics & Reporting

### Assessment Dashboard Analytics
**Admin Only**

```http
GET /api/analytics/assessment/dashboard?period=month&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSubmissions": 234,
      "completedSubmissions": 198,
      "pendingReviews": 8,
      "totalReviews": 190,
      "totalUsers": 145,
      "totalReels": 87,
      "completionRate": 84.6,
      "avgReviewTimeHours": 18
    },
    "trends": {
      "submissions": [
        {
          "_id": { "year": 2024, "month": 1, "day": 15 },
          "total": 12,
          "completed": 10
        }
      ]
    },
    "assessmentPerformance": [
      {
        "_id": "64f7a1b2e8c9d4567890abcd",
        "assessmentTitle": "Multimedia Annotation Assessment",
        "totalSubmissions": 156,
        "avgCompletionTime": 2730000,
        "avgScore": 7.8
      }
    ],
    "qaPerformance": [
      {
        "_id": "64f7a1b2e8c9d4567890abcd",
        "reviewerName": "Sarah Johnson",
        "totalReviews": 45,
        "avgReviewScore": 7.9,
        "approvals": 33,
        "rejections": 8,
        "approvalRate": 73.3
      }
    ]
  }
}
```

### Reel Usage Analytics
**Admin Only**

```http
GET /api/analytics/reels?period=month
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reelUsage": [
      {
        "title": "JavaScript Tutorial",
        "niche": "technology",
        "usageCount": 45,
        "usageRate": 1.5,
        "duration": 45.7,
        "aspectRatio": "9:16"
      }
    ],
    "nicheAnalytics": [
      {
        "_id": "technology",
        "totalReels": 23,
        "totalUsage": 187,
        "avgUsagePerReel": 8.1,
        "avgDuration": 38.4
      }
    ],
    "summary": {
      "totalActiveReels": 87,
      "totalUsages": 1456,
      "avgUsagePerReel": 16.7,
      "mostPopularNiche": "technology"
    }
  }
}
```

### User Performance Analytics
**Admin Only**

```http
GET /api/analytics/users?period=month
Authorization: Bearer <admin_token>
```

### QA Analytics
**Admin Only**

```http
GET /api/analytics/qa?period=month
Authorization: Bearer <admin_token>
```

### Export Analytics Data
**Admin Only**

```http
GET /api/analytics/export?type=submissions&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin_token>
```

**Response:** CSV file download

---

## YouTube Integration Requirements

### Environment Configuration

The system requires YouTube Data API v3 integration. Add the following environment variables:

```bash
# Required
YOUTUBE_API_KEY=your_youtube_data_api_v3_key

# Optional
YOUTUBE_API_QUOTA_LIMIT=10000
YOUTUBE_API_REQUESTS_PER_SECOND=1
```

### YouTube API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable YouTube Data API v3
4. Create API credentials (API Key)
5. Configure the API key in your environment

### Video Requirements

- **URL Format**: YouTube embed URLs (`https://www.youtube.com/embed/VIDEO_ID`) are preferred for CORS compatibility
- **Auto-Conversion**: System automatically converts Shorts, watch, and youtu.be URLs to embed format
- **Duration**: Maximum 60 seconds (YouTube Shorts requirement)
- **Accessibility**: Must be public videos (not private/unlisted)
- **Content**: No age-restricted content for assessments
- **Aspect Ratio**: Preferably 9:16 (portrait) for mobile viewing
- **CORS Policy**: Embed URLs resolve frontend CORS policy issues

### Rate Limiting

- YouTube API: 10,000 units per day (default quota)
- Video details request: 1-4 units per request
- System implements automatic rate limiting (1 request per second)
- Bulk operations include delays between requests

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information",
  "code": "ERROR_CODE" // Optional
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED` (401): Missing or invalid authentication
- `INSUFFICIENT_PERMISSIONS` (403): User lacks required permissions
- `VALIDATION_ERROR` (400): Request validation failed
- `RESOURCE_NOT_FOUND` (404): Requested resource doesn't exist
- `ASSESSMENT_COOLDOWN_ACTIVE` (400): User in retake cooldown period
- `ASSESSMENT_TIME_EXPIRED` (400): Assessment time limit exceeded
- `INVALID_YOUTUBE_URL` (400): YouTube URL format is invalid or cannot be converted to embed format
- `YOUTUBE_VIDEO_NOT_FOUND` (400): YouTube video is private, deleted, or not found
- `DUPLICATE_YOUTUBE_URL` (409): Video with this YouTube URL already exists
- `YOUTUBE_API_ERROR` (400): Failed to extract data from YouTube
- `YOUTUBE_API_QUOTA_EXCEEDED` (429): YouTube API quota limit reached
- `SERVER_ERROR` (500): Internal server error

### YouTube-Specific Error Examples

**Invalid YouTube URL:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Invalid YouTube embed URL format"]
}
```

**Duplicate Video:**
```json
{
  "success": false,
  "message": "Video with this YouTube URL already exists",
  "videoReel": {
    "_id": "existing_video_id",
    "title": "Existing Video Title"
  }
}
```

**YouTube API Error:**
```json
{
  "success": false,
  "message": "Failed to extract video data from YouTube URL"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Assessment Operations**: 100 requests per hour per user
- **File Uploads**: 10 uploads per hour per user
- **Analytics**: 50 requests per hour per user
- **General API**: 1000 requests per hour per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 956
X-RateLimit-Reset: 1642694400
```

---

## Webhooks (Optional)

Configure webhooks to receive real-time notifications:

### Assessment Completion Webhook
```json
{
  "event": "assessment.completed",
  "timestamp": "2024-01-15T11:15:00Z",
  "data": {
    "submissionId": "64f7a1b2e8c9d4567890abcd",
    "userId": "64f7a1b2e8c9d4567890abcd",
    "assessmentId": "64f7a1b2e8c9d4567890abcd",
    "status": "submitted",
    "totalScore": 8.3
  }
}
```

### QA Review Completion Webhook
```json
{
  "event": "qa.review_completed",
  "timestamp": "2024-01-15T15:30:00Z",
  "data": {
    "submissionId": "64f7a1b2e8c9d4567890abcd",
    "decision": "Approve",
    "overallScore": 8.3,
    "reviewerId": "64f7a1b2e8c9d4567890abcd"
  }
}
```

---

## SDKs and Client Libraries

### JavaScript/Node.js
```bash
npm install mydeeptech-assessment-sdk
```

```javascript
const { AssessmentClient } = require('mydeeptech-assessment-sdk');

const client = new AssessmentClient({
  baseURL: 'https://api.mydeeptech.ng',
  apiKey: 'your-api-key'
});

// Start assessment
const session = await client.assessments.start(assessmentId);

// Submit task
await client.assessments.submitTask(submissionId, taskData);
```

### Python
```bash
pip install mydeeptech-assessment-python
```

```python
from mydeeptech import AssessmentClient

client = AssessmentClient(
    base_url='https://api.mydeeptech.ng',
    api_key='your-api-key'
)

# Start assessment
session = client.assessments.start(assessment_id)

# Submit task
client.assessments.submit_task(submission_id, task_data)
```

---

## Support

For API support and questions:
- **Documentation**: https://docs.mydeeptech.ng/api
- **Support Email**: api-support@mydeeptech.ng
- **Discord Community**: https://discord.gg/mydeeptech
- **Status Page**: https://status.mydeeptech.ng