# Assessment API Documentation for Frontend

## Base URL
```
http://localhost:5000/api/assessments
```

## Authentication
All assessment endpoints require user authentication. Include the user token in the Authorization header:
```javascript
headers: {
  'Authorization': 'Bearer <user_token>',
  'Content-Type': 'application/json'
}
```

---

## 📝 **1. Get Assessment Questions**

**Endpoint:** `GET /api/assessments/questions`

**Description:** Retrieve randomized assessment questions for the user to take the assessment.

### Request Parameters
```javascript
// Query Parameters (all optional)
{
  questionsPerSection: 5  // Number of questions per section (default: 5)
}
```

### Request Example
```javascript
const response = await fetch('/api/assessments/questions?questionsPerSection=5', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_user_token',
    'Content-Type': 'application/json'
  }
});
```

### Response Format
```javascript
{
  "success": true,
  "message": "Assessment questions retrieved successfully",
  "data": {
    "questions": [
      {
        "id": "unique_question_id",
        "section": "Comprehension",  // Comprehension, Vocabulary, Grammar, Writing
        "question": "What is the main idea of the following passage: [passage text]",
        "options": [
          "Option A text",
          "Option B text", 
          "Option C text",
          "Option D text"
        ],
        "points": 5
      },
      // ... more questions (randomized order)
    ],
    "metadata": {
      "totalQuestions": 20,
      "sections": ["Comprehension", "Vocabulary", "Grammar", "Writing"],
      "questionsPerSection": 5,
      "maxPoints": 100,
      "timeLimit": "No time limit"
    }
  }
}
```

---

## 📤 **2. Submit Assessment**

**Endpoint:** `POST /api/assessments/submit`

**Description:** Submit completed assessment answers and get results with automatic user status update.

### Request Payload
```javascript
{
  "assessmentType": "annotator_qualification",  // Required: annotator_qualification | skill_assessment | project_specific
  "startedAt": "2025-11-14T10:00:00.000Z",     // Required: ISO timestamp when user started
  "completedAt": "2025-11-14T10:30:00.000Z",   // Required: ISO timestamp when user completed
  "answers": [                                  // Required: Array of user answers
    {
      "questionId": "unique_question_id",       // Required: Must match question ID from /questions
      "selectedOption": "Option A text",       // Required: Exact text of selected option
      "section": "Comprehension",              // Required: Question section
      "points": 5                              // Required: Points for this question
    },
    {
      "questionId": "another_question_id",
      "selectedOption": "Option C text", 
      "section": "Vocabulary",
      "points": 5
    }
    // ... include ALL questions received from /questions endpoint
  ],
  "passingScore": 70                           // Required: Minimum score to pass (usually 70)
}
```

### Complete Request Example
```javascript
const assessmentData = {
  assessmentType: "annotator_qualification",
  startedAt: startTime.toISOString(),
  completedAt: new Date().toISOString(),
  answers: userAnswers, // Array collected from frontend form
  passingScore: 70
};

const response = await fetch('/api/assessments/submit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_user_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(assessmentData)
});
```

### Response Format
```javascript
{
  "success": true,
  "message": "Assessment submitted and graded successfully",
  "data": {
    "assessment": {
      "id": "assessment_record_id",
      "assessmentType": "annotator_qualification",
      "totalQuestions": 20,
      "correctAnswers": 16,
      "totalScore": 80,
      "percentage": 80,
      "passed": true,
      "passingScore": 70,
      "timeTaken": 1800,  // seconds
      "submittedAt": "2025-11-14T10:30:00.000Z"
    },
    "sectionBreakdown": {
      "Comprehension": {
        "totalQuestions": 5,
        "correctAnswers": 4,
        "score": 20,
        "percentage": 80
      },
      "Vocabulary": {
        "totalQuestions": 5, 
        "correctAnswers": 4,
        "score": 20,
        "percentage": 80
      },
      "Grammar": {
        "totalQuestions": 5,
        "correctAnswers": 4, 
        "score": 20,
        "percentage": 80
      },
      "Writing": {
        "totalQuestions": 5,
        "correctAnswers": 4,
        "score": 20,
        "percentage": 80
      }
    },
    "userStatusUpdate": {
      "previousStatus": "pending",
      "newStatus": "verified",  // Updated based on passing assessment
      "statusChanged": true,
      "updatedAt": "2025-11-14T10:30:00.000Z"
    },
    "nextSteps": {
      "message": "Congratulations! You passed the assessment.",
      "canApplyToProjects": true,
      "accessLevel": "verified_annotator"
    }
  }
}
```

---

## 📊 **3. Get Assessment History**

**Endpoint:** `GET /api/assessments/history`

**Description:** Retrieve user's previous assessment attempts and results.

### Request Parameters
```javascript
// Query Parameters (all optional)
{
  page: 1,                    // Page number for pagination
  limit: 10,                  // Results per page
  assessmentType: "annotator_qualification", // Filter by assessment type
  passed: true                // Filter by pass/fail status
}
```

### Request Example
```javascript
const response = await fetch('/api/assessments/history?page=1&limit=5', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_user_token',
    'Content-Type': 'application/json'
  }
});
```

### Response Format
```javascript
{
  "success": true,
  "message": "Assessment history retrieved successfully",
  "data": {
    "assessments": [
      {
        "id": "assessment_id",
        "assessmentType": "annotator_qualification",
        "totalQuestions": 20,
        "correctAnswers": 16,
        "totalScore": 80,
        "percentage": 80,
        "passed": true,
        "passingScore": 70,
        "timeTaken": 1800,
        "submittedAt": "2025-11-14T10:30:00.000Z",
        "sectionBreakdown": {
          "Comprehension": { "score": 20, "percentage": 80 },
          "Vocabulary": { "score": 20, "percentage": 80 },
          "Grammar": { "score": 20, "percentage": 80 },
          "Writing": { "score": 20, "percentage": 80 }
        }
      }
      // ... more assessments
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalAssessments": 3,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 10
    },
    "statistics": {
      "totalAttempts": 3,
      "passedAttempts": 1,
      "failedAttempts": 2,
      "averageScore": 65,
      "bestScore": 80,
      "lastAttempt": "2025-11-14T10:30:00.000Z"
    }
  }
}
```

---

## ⏱️ **4. Check Retake Eligibility**

**Endpoint:** `GET /api/assessments/retake-eligibility`

**Description:** Check if user can retake the assessment (24-hour cooldown period).

### Request Parameters
```javascript
// Query Parameters (all optional)
{
  assessmentType: "annotator_qualification"  // Check eligibility for specific assessment type
}
```

### Request Example
```javascript
const response = await fetch('/api/assessments/retake-eligibility', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_user_token',
    'Content-Type': 'application/json'
  }
});
```

### Response Format
```javascript
{
  "success": true,
  "message": "Retake eligibility checked successfully",
  "data": {
    "canRetake": false,
    "reason": "Must wait 24 hours between assessment attempts",
    "lastAttempt": "2025-11-14T10:30:00.000Z",
    "nextEligibleTime": "2025-11-15T10:30:00.000Z",
    "hoursToWait": 18,
    "assessmentType": "annotator_qualification"
  }
}
```

**When user CAN retake:**
```javascript
{
  "success": true,
  "message": "Retake eligibility checked successfully", 
  "data": {
    "canRetake": true,
    "reason": "No recent attempts found",
    "lastAttempt": null,
    "nextEligibleTime": null,
    "hoursToWait": 0,
    "assessmentType": "annotator_qualification"
  }
}
```

---

## 🚨 **Error Responses**

### Authentication Error (401)
```javascript
{
  "success": false,
  "message": "User authentication required"
}
```

### Validation Error (400)
```javascript
{
  "success": false,
  "message": "Validation error",
  "errors": [
    "assessmentType is required",
    "answers must contain at least 1 item"
  ]
}
```

### Retake Cooldown Error (400)
```javascript
{
  "success": false,
  "message": "You must wait 24 hours before retaking the assessment",
  "data": {
    "canRetake": false,
    "nextEligibleTime": "2025-11-15T10:30:00.000Z",
    "hoursToWait": 18
  }
}
```

### Server Error (500)
```javascript
{
  "success": false,
  "message": "Server error processing assessment",
  "error": "Detailed error message"
}
```

---

## 🏗️ **Frontend Implementation Guide**

### Complete Assessment Flow
```javascript
class AssessmentService {
  constructor(apiBaseUrl, userToken) {
    this.baseUrl = `${apiBaseUrl}/api/assessments`;
    this.headers = {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Step 1: Check if user can take assessment
  async checkRetakeEligibility() {
    const response = await fetch(`${this.baseUrl}/retake-eligibility`, {
      method: 'GET',
      headers: this.headers
    });
    return await response.json();
  }

  // Step 2: Get assessment questions
  async getQuestions(questionsPerSection = 5) {
    const response = await fetch(`${this.baseUrl}/questions?questionsPerSection=${questionsPerSection}`, {
      method: 'GET',
      headers: this.headers
    });
    return await response.json();
  }

  // Step 3: Submit assessment
  async submitAssessment(assessmentData) {
    const response = await fetch(`${this.baseUrl}/submit`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(assessmentData)
    });
    return await response.json();
  }

  // Get assessment history
  async getHistory(page = 1, limit = 10) {
    const response = await fetch(`${this.baseUrl}/history?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: this.headers
    });
    return await response.json();
  }
}
```

### Usage Example
```javascript
// Initialize service
const assessmentService = new AssessmentService('http://localhost:5000', userToken);

// Complete assessment flow
async function takeAssessment() {
  try {
    // 1. Check eligibility
    const eligibility = await assessmentService.checkRetakeEligibility();
    if (!eligibility.data.canRetake) {
      alert(`You must wait ${eligibility.data.hoursToWait} hours before retaking`);
      return;
    }

    // 2. Get questions
    const questionsResponse = await assessmentService.getQuestions(5);
    const questions = questionsResponse.data.questions;
    
    // 3. Present questions to user (your UI logic here)
    const startTime = new Date();
    const userAnswers = await presentQuestionsToUser(questions);
    const endTime = new Date();

    // 4. Submit assessment
    const submissionData = {
      assessmentType: "annotator_qualification",
      startedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
      answers: userAnswers,
      passingScore: 70
    };

    const result = await assessmentService.submitAssessment(submissionData);
    
    // 5. Show results to user
    if (result.success) {
      showResults(result.data);
    }

  } catch (error) {
    console.error('Assessment error:', error);
  }
}
```

### Answer Format Example
```javascript
// How to format user answers for submission
const userAnswers = [
  {
    questionId: "question_1_id",
    selectedOption: "The main theme is about persistence",
    section: "Comprehension", 
    points: 5
  },
  {
    questionId: "question_2_id", 
    selectedOption: "Meticulous",
    section: "Vocabulary",
    points: 5
  }
  // ... all questions must be included
];
```

---

## 📋 **Key Points for Frontend**

1. **Authentication Required**: All endpoints need valid user token
2. **Question Order**: Questions are randomized - use the `id` field to track them
3. **All Questions Required**: Submit answers for ALL questions received from `/questions`
4. **24-Hour Cooldown**: Check eligibility before allowing assessment
5. **Automatic Status Update**: User status changes based on assessment results
6. **Section-Based Scoring**: Results show breakdown by Comprehension, Vocabulary, Grammar, Writing
7. **Minimum Score**: Usually 70% to pass (configurable per assessment)

This documentation provides everything your frontend team needs to implement the assessment functionality! 🚀