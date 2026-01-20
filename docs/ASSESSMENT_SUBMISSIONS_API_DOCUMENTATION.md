# 📊 Assessment Submissions Viewing API

## Overview
This endpoint allows viewing submissions for specific assessments, supporting both English Proficiency and Multimedia assessments.

## Endpoint
```
GET /api/assessments/{assessmentId}/submissions
```

## Assessment ID Types
- **English Proficiency**: Use `english-proficiency` as the assessmentId
- **Multimedia Assessment**: Use the MongoDB ObjectId of the multimedia assessment

## Authentication
- **Users**: Can view their own submissions only
- **Admins**: Can view all submissions for any assessment

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 10 | Number of submissions per page (max 50) |
| `status` | string | - | Filter by submission status |
| `userId` | string | - | Filter by user ID (admin only) |
| `sortBy` | string | createdAt | Field to sort by |
| `sortOrder` | string | desc | Sort order: 'asc' or 'desc' |

### Status Values
**English Proficiency:**
- `passed` - Assessment passed (score ≥ 60%)
- `failed` - Assessment failed (score < 60%)

**Multimedia Assessment:**
- `not_started` - Assessment not started
- `in_progress` - Assessment in progress
- `submitted` - Assessment submitted
- `under_review` - Under review
- `passed` - Assessment passed
- `failed` - Assessment failed

## Example Requests

### 1. View English Proficiency Submissions (Admin)
```bash
curl -X GET "http://localhost:3000/api/assessments/english-proficiency/submissions?page=1&limit=10&status=passed" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json"
```

### 2. View Multimedia Assessment Submissions
```bash
curl -X GET "http://localhost:3000/api/assessments/60f7b3b3b3b3b3b3b3b3b3b3/submissions?page=1&limit=5&status=submitted" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

### 3. View Own Submissions (User)
```bash
curl -X GET "http://localhost:3000/api/assessments/english-proficiency/submissions" \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json"
```

### 4. Filter by User (Admin Only)
```bash
curl -X GET "http://localhost:3000/api/assessments/english-proficiency/submissions?userId=60f7b3b3b3b3b3b3b3b3b3b4" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json"
```

## Response Structure

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Assessment submissions retrieved successfully",
  "data": {
    "assessment": {
      "id": "english-proficiency",
      "type": "english_proficiency",
      "title": "English Proficiency Assessment",
      "description": "Annotator qualification assessment covering comprehension, vocabulary, grammar, and writing",
      "passingScore": 60,
      "totalQuestions": 20,
      "sections": ["Comprehension", "Vocabulary", "Grammar", "Writing"]
    },
    "submissions": [
      {
        "id": "676123abc456def789012345",
        "type": "english_proficiency",
        "user": {
          "id": "675f1234567890abcdef1234",
          "fullName": "John Doe",
          "email": "john@example.com",
          "annotatorStatus": "approved",
          "microTaskerStatus": "approved",
          "qaStatus": "approved"
        },
        "submission": {
          "scorePercentage": 85,
          "correctAnswers": 17,
          "totalQuestions": 20,
          "passed": true,
          "passingScore": 60,
          "timeSpent": 1800,
          "formattedTimeSpent": "30 minutes",
          "attemptNumber": 1,
          "isRetake": false,
          "submittedAt": "2025-12-16T10:30:00.000Z",
          "categories": ["Comprehension", "Vocabulary", "Grammar", "Writing"]
        },
        "sectionPerformance": {
          "Comprehension": { "correct": 4, "total": 5 },
          "Vocabulary": { "correct": 5, "total": 5 },
          "Grammar": { "correct": 4, "total": 5 },
          "Writing": { "correct": 4, "total": 5 }
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 25,
      "hasNext": true,
      "hasPrev": false,
      "limit": 10
    },
    "statistics": {
      "total": 25,
      "passed": 20,
      "failed": 5,
      "averageScore": 78.5
    },
    "filters": {
      "assessmentId": "english-proficiency",
      "status": "passed",
      "userId": "all",
      "sortBy": "createdAt",
      "sortOrder": "desc"
    }
  }
}
```

### Multimedia Assessment Response
```json
{
  "success": true,
  "message": "Assessment submissions retrieved successfully",
  "data": {
    "assessment": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "type": "multimedia_assessment",
      "title": "Video Annotation Assessment",
      "description": "Advanced multimedia assessment for video annotation projects",
      "requirements": {
        "timeLimit": 3600,
        "minTasksToComplete": 5
      },
      "scoring": {
        "passingScore": 70,
        "maxScore": 100
      },
      "maxAttempts": 3,
      "cooldownHours": 24,
      "isActive": true
    },
    "submissions": [
      {
        "id": "676456def789012345678901",
        "type": "multimedia_assessment",
        "user": {
          "id": "675f1234567890abcdef1234",
          "fullName": "Jane Smith",
          "email": "jane@example.com",
          "annotatorStatus": "approved",
          "microTaskerStatus": "pending",
          "qaStatus": "approved"
        },
        "submission": {
          "status": "submitted",
          "scorePercentage": 85,
          "completionPercentage": 100,
          "totalTimeSpent": 2700,
          "formattedTimeSpent": "45 minutes",
          "attemptNumber": 1,
          "tasksCompleted": 5,
          "totalTasks": 5,
          "submittedAt": "2025-12-16T11:15:00.000Z",
          "startedAt": "2025-12-16T10:30:00.000Z",
          "autoSaveCount": 12,
          "lastAutoSave": "2025-12-16T11:10:00.000Z"
        },
        "project": {
          "id": "675e1234567890abcdef1234",
          "name": "Product Review Videos",
          "category": "E-commerce"
        },
        "taskDetails": [
          {
            "taskNumber": 1,
            "isCompleted": true,
            "timeSpent": 540,
            "submittedAt": "2025-12-16T10:39:00.000Z",
            "conversationLength": 8
          },
          {
            "taskNumber": 2,
            "isCompleted": true,
            "timeSpent": 520,
            "submittedAt": "2025-12-16T10:47:20.000Z",
            "conversationLength": 6
          }
        ]
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCount": 15,
      "hasNext": true,
      "hasPrev": false,
      "limit": 10
    },
    "statistics": {
      "total": 15,
      "submitted": 8,
      "passed": 5,
      "in_progress": 2,
      "averageScore": 76.3
    },
    "filters": {
      "assessmentId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "status": "all",
      "userId": "all",
      "sortBy": "createdAt",
      "sortOrder": "desc"
    }
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. You can only view your own submissions unless you are an admin."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Multimedia assessment not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to fetch assessment submissions",
  "error": "Database connection error"
}
```

## Features

### ✅ Security & Access Control
- **Role-based access**: Users see only their submissions, admins see all
- **Authentication required**: Valid JWT token must be provided
- **Data filtering**: Sensitive information is hidden from responses

### ✅ Flexible Filtering & Sorting
- **Status filtering**: Filter by pass/fail status or submission status
- **User filtering**: Admin can filter by specific user ID
- **Custom sorting**: Sort by any field in ascending or descending order
- **Pagination**: Efficient pagination with metadata

### ✅ Rich Data Response
- **Complete user info**: User details with status information
- **Detailed submissions**: Comprehensive submission data with performance metrics
- **Section performance**: For English assessments, performance breakdown by section
- **Task details**: For multimedia assessments, individual task completion info
- **Statistics**: Summary statistics for the filtered dataset

### ✅ Assessment Type Support
- **English Proficiency**: Full support for annotator qualification assessments
- **Multimedia**: Complete multimedia assessment submission viewing
- **Future-proof**: Easy to extend for additional assessment types

## Integration Notes

### Frontend Integration
```javascript
// Example: Fetch English proficiency submissions
const fetchEnglishSubmissions = async () => {
  const response = await fetch('/api/assessments/english-proficiency/submissions?page=1&limit=10', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  if (data.success) {
    return data.data;
  }
  throw new Error(data.message);
};

// Example: Fetch multimedia assessment submissions
const fetchMultimediaSubmissions = async (assessmentId) => {
  const response = await fetch(`/api/assessments/${assessmentId}/submissions?status=submitted`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  if (data.success) {
    return data.data;
  }
  throw new Error(data.message);
};
```

### Admin Dashboard Integration
```javascript
// Example: Admin viewing all submissions for an assessment
const adminViewSubmissions = async (assessmentId, filters = {}) => {
  const params = new URLSearchParams(filters);
  
  const response = await fetch(`/api/assessments/${assessmentId}/submissions?${params}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
};
```

## Performance Considerations

- **Pagination**: Use pagination to handle large datasets efficiently
- **Indexing**: Database indexes on `userId`, `assessmentType`, `assessmentId` for fast queries
- **Data Selection**: Sensitive fields are excluded from responses
- **Aggregation**: Statistics are computed efficiently using aggregation pipelines

## Changelog

- **v1.0.0**: Initial implementation supporting both English proficiency and multimedia assessments
- Added role-based access control
- Implemented comprehensive filtering and sorting options
- Added detailed response structure with statistics and pagination