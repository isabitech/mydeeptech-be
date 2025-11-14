# Assessment System API Documentation

## Overview
The Assessment System provides automated annotator qualification through scoring-based evaluation. When users complete assessments, their status is automatically updated based on performance:

- **Score ≥ 60%**: Approved as annotator
- **Score < 60%**: Rejected as annotator, approved as micro tasker

## Endpoints

### 1. Submit Assessment (Auto Status Update)
**Endpoint:** `POST /api/assessments/submit`

**Description:** Submit assessment answers and automatically update user status based on score

**Authentication:** User authentication required

**Request Body:**
```json
{
  "assessmentType": "annotator_qualification",
  "startedAt": "2024-11-14T10:00:00.000Z",
  "completedAt": "2024-11-14T10:15:00.000Z",
  "questions": [
    {
      "questionId": "q1",
      "questionText": "What is data annotation?",
      "questionType": "multiple_choice",
      "options": [
        {
          "optionId": "a",
          "optionText": "Labeling data for machine learning",
          "isCorrect": true
        },
        {
          "optionId": "b", 
          "optionText": "Deleting unwanted data",
          "isCorrect": false
        }
      ],
      "correctAnswer": "a",
      "userAnswer": "a",
      "pointsAwarded": 1,
      "maxPoints": 1
    },
    {
      "questionId": "q2",
      "questionText": "Is quality important in annotation?",
      "questionType": "true_false",
      "correctAnswer": true,
      "userAnswer": true,
      "pointsAwarded": 1,
      "maxPoints": 1
    }
  ],
  "category": "general",
  "difficulty": "intermediate",
  "passingScore": 60
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Assessment completed successfully. You PASSED with 85%",
  "data": {
    "assessmentId": "64f8a1b2c3d4e5f6789",
    "results": {
      "totalQuestions": 10,
      "correctAnswers": 8,
      "scorePercentage": 80,
      "passed": true,
      "grade": "B",
      "timeSpent": "15m"
    },
    "statusChanges": {
      "statusChanged": true,
      "before": {
        "annotatorStatus": "pending",
        "microTaskerStatus": "pending"
      },
      "after": {
        "annotatorStatus": "approved",
        "microTaskerStatus": "pending"
      }
    },
    "attemptInfo": {
      "attemptNumber": 1,
      "isRetake": false,
      "previousBestScore": null
    }
  }
}
```

**Failed Assessment Response (201):**
```json
{
  "success": true,
  "message": "Assessment completed successfully. You FAILED with 45%",
  "data": {
    "assessmentId": "64f8a1b2c3d4e5f6790",
    "results": {
      "totalQuestions": 10,
      "correctAnswers": 4,
      "scorePercentage": 45,
      "passed": false,
      "grade": "F",
      "timeSpent": "12m"
    },
    "statusChanges": {
      "statusChanged": true,
      "before": {
        "annotatorStatus": "pending",
        "microTaskerStatus": "pending"
      },
      "after": {
        "annotatorStatus": "rejected",
        "microTaskerStatus": "approved"
      }
    },
    "attemptInfo": {
      "attemptNumber": 1,
      "isRetake": false,
      "previousBestScore": null
    }
  }
}
```

### 2. Check Retake Eligibility
**Endpoint:** `GET /api/assessments/retake-eligibility`

**Description:** Check if user can retake assessment (24-hour cooldown period)

**Authentication:** User authentication required

**Query Parameters:**
- `assessmentType` (optional): Type of assessment (default: "annotator_qualification")

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "canRetake": false,
    "assessmentType": "annotator_qualification",
    "nextRetakeTime": "2024-11-15T10:00:00.000Z",
    "latestAttempt": {
      "date": "2024-11-14T10:00:00.000Z",
      "score": 45,
      "passed": false,
      "attemptNumber": 1
    },
    "bestScore": {
      "date": "2024-11-14T10:00:00.000Z",
      "score": 45,
      "passed": false
    }
  }
}
```

### 3. Get Assessment History
**Endpoint:** `GET /api/assessments/history`

**Description:** Retrieve user's assessment history with statistics

**Authentication:** User authentication required

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `assessmentType` (optional): Filter by assessment type
- `passed` (optional): Filter by pass/fail status

**Success Response (200):**
```json
{
  "success": true,
  "message": "Assessment history retrieved successfully",
  "data": {
    "assessments": [
      {
        "_id": "64f8a1b2c3d4e5f6789",
        "assessmentType": "annotator_qualification",
        "scorePercentage": 80,
        "passed": true,
        "timeSpentMinutes": 15,
        "attemptNumber": 1,
        "createdAt": "2024-11-14T10:15:00.000Z",
        "questions": [
          {
            "questionId": "q1",
            "questionText": "What is data annotation?",
            "userAnswer": "a",
            "isCorrect": true
          }
        ]
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "statistics": [
      {
        "_id": "annotator_qualification",
        "totalAttempts": 1,
        "passedAttempts": 1,
        "averageScore": 80,
        "bestScore": 80,
        "lastAttempt": "2024-11-14T10:15:00.000Z"
      }
    ]
  }
}
```

### 4. Admin: Get All Assessments
**Endpoint:** `GET /api/admin/assessments`

**Description:** Admin endpoint to view all user assessments with filtering

**Authentication:** Admin authentication required

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 50)
- `assessmentType` (optional): Filter by assessment type
- `passed` (optional): Filter by pass/fail status
- `userId` (optional): Filter by specific user

**Success Response (200):**
```json
{
  "success": true,
  "message": "Admin assessments retrieved successfully",
  "data": {
    "assessments": [
      {
        "_id": "64f8a1b2c3d4e5f6789",
        "userId": {
          "_id": "64f8a1b2c3d4e5f6787",
          "fullName": "John Doe",
          "email": "john.doe@example.com",
          "annotatorStatus": "approved",
          "microTaskerStatus": "pending"
        },
        "assessmentType": "annotator_qualification",
        "scorePercentage": 80,
        "passed": true,
        "attemptNumber": 1,
        "timeSpentMinutes": 15,
        "createdAt": "2024-11-14T10:15:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 47,
      "hasNext": true,
      "hasPrev": false
    },
    "statistics": {
      "totalAssessments": 47,
      "passedAssessments": 32,
      "averageScore": 72.3,
      "uniqueUserCount": 35,
      "passRate": 68.1
    }
  }
}
```

## Assessment Question Types

### 1. Multiple Choice
```json
{
  "questionType": "multiple_choice",
  "questionText": "What is the purpose of data annotation?",
  "options": [
    { "optionId": "a", "optionText": "To label data", "isCorrect": true },
    { "optionId": "b", "optionText": "To delete data", "isCorrect": false }
  ],
  "correctAnswer": "a",
  "userAnswer": "a"
}
```

### 2. True/False
```json
{
  "questionType": "true_false",
  "questionText": "Quality is important in data annotation.",
  "correctAnswer": true,
  "userAnswer": true
}
```

### 3. Text Input
```json
{
  "questionType": "text_input",
  "questionText": "What does AI stand for?",
  "correctAnswer": "Artificial Intelligence",
  "userAnswer": "artificial intelligence"
}
```

## Automatic Status Updates

### Pass Scenario (Score ≥ 60%)
- `annotatorStatus`: "pending" → "approved"
- `microTaskerStatus`: Remains unchanged
- Email: Annotator approval email sent
- Notification: "Assessment Passed - Annotator Approved!"

### Fail Scenario (Score < 60%)
- `annotatorStatus`: "pending" → "rejected"  
- `microTaskerStatus`: "pending" → "approved"
- Email: Micro tasker approval email sent
- Notification: "Assessment Complete - Micro Tasker Approved"

## Assessment Rules

### Scoring Logic
- Each question worth 1 point by default
- Score percentage = (correct answers / total questions) × 100
- Pass threshold: 60% (configurable)

### Retake Policy
- 24-hour cooldown between attempts
- Unlimited retakes allowed
- Previous attempts tracked in history
- Best score displayed in user profile

### Security Features
- IP address tracking
- User agent logging
- Attempt number validation
- Time spent verification

## Integration Points

### Email Notifications
- Uses existing `annotatorMailer.js` functions
- `sendAnnotatorApprovalEmail()` for passed assessments
- `sendAnnotatorRejectionEmail()` for failed assessments

### In-App Notifications
- Creates notifications via `NotificationService`
- High priority for status changes
- Action buttons for next steps

### Status Synchronization
- Real-time status updates in user model
- Immediate effect on permissions
- Audit trail maintained

## Usage Examples

### Frontend Integration
```javascript
// Submit assessment
const submitAssessment = async (assessmentData) => {
  const response = await fetch('/api/assessments/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      assessmentType: 'annotator_qualification',
      startedAt: startTime,
      completedAt: new Date(),
      questions: answeredQuestions,
      passingScore: 60
    })
  });
  
  const result = await response.json();
  
  if (result.data.statusChanges.statusChanged) {
    // User status has changed - redirect or update UI
    if (result.data.results.passed) {
      // Redirect to annotator dashboard
      window.location.href = '/annotator/dashboard';
    } else {
      // Redirect to micro tasker dashboard  
      window.location.href = '/microtasker/dashboard';
    }
  }
};

// Check retake eligibility
const checkRetakeEligibility = async () => {
  const response = await fetch('/api/assessments/retake-eligibility', {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  
  const result = await response.json();
  
  if (result.data.canRetake) {
    // Show retake button
  } else {
    // Show countdown to next retake
    const nextRetake = new Date(result.data.nextRetakeTime);
    // Display countdown timer
  }
};
```

### Assessment Question Builder
```javascript
const buildQuestion = (type, text, options, correct) => {
  const question = {
    questionId: generateId(),
    questionText: text,
    questionType: type,
    correctAnswer: correct,
    userAnswer: null, // To be filled by user
    pointsAwarded: 1,
    maxPoints: 1
  };
  
  if (type === 'multiple_choice') {
    question.options = options.map((opt, idx) => ({
      optionId: String.fromCharCode(97 + idx), // a, b, c, d
      optionText: opt,
      isCorrect: opt === correct
    }));
  }
  
  return question;
};

// Example usage
const questions = [
  buildQuestion(
    'multiple_choice',
    'What is the main goal of data annotation?',
    ['To label data for ML training', 'To delete unnecessary data', 'To compress data'],
    'To label data for ML training'
  ),
  buildQuestion(
    'true_false',
    'Consistency is important in annotation tasks.',
    null,
    true
  )
];
```

This assessment system provides a complete solution for automatic user qualification based on performance, with comprehensive tracking, security features, and seamless integration with your existing user management system.