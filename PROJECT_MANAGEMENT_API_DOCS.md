# Project Management API Documentation

## Overview
Complete project management system for annotation tasks where admins can create projects, users can apply, and automated email notifications handle the workflow.

## Base URL
```
http://localhost:5000/api
```

## Authentication
- **Admin endpoints**: Require JWT token with admin privileges
- **User endpoints**: Require JWT token from authenticated DTUsers
- **Headers**: `Authorization: Bearer <token>`

---

## 🔐 Admin Endpoints

### 1. Create Annotation Project
**POST** `/admin/projects`

Creates a new annotation project with detailed specifications.

#### Headers
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "projectName": "Image Classification for Self-Driving Cars",
  "projectDescription": "Classify and annotate objects in driving scenarios to train autonomous vehicle AI models.",
  "projectCategory": "Image Annotation",
  "payRate": 30.00,
  "payRateCurrency": "USD",
  "payRateType": "per_hour",
  "maxAnnotators": 5,
  "deadline": "2025-12-31T23:59:59.000Z",
  "estimatedDuration": "4-6 weeks",
  "difficultyLevel": "advanced",
  "requiredSkills": ["Computer Vision", "Image Annotation", "Object Detection"],
  "minimumExperience": "intermediate",
  "languageRequirements": ["English"],
  "tags": ["AI", "Autonomous Vehicles", "Computer Vision"],
  "applicationDeadline": "2025-11-30T23:59:59.000Z"
}
```

#### Field Descriptions
- `projectName` (required): Project title (max 200 chars)
- `projectDescription` (required): Detailed description (max 2000 chars)
- `projectCategory` (required): Category from predefined list
- `payRate` (required): Payment amount (minimum 0)
- `payRateCurrency`: Currency code (USD, EUR, GBP, NGN, KES, GHS)
- `payRateType`: Payment structure (per_task, per_hour, per_project, per_annotation)
- `maxAnnotators`: Maximum number of annotators (null = unlimited)
- `deadline`: Project completion deadline
- `difficultyLevel`: beginner, intermediate, advanced, expert
- `requiredSkills`: Array of required skills
- `minimumExperience`: none, beginner, intermediate, advanced

#### Project Categories
- Text Annotation
- Image Annotation
- Audio Annotation
- Video Annotation
- Data Labeling
- Content Moderation
- Transcription
- Translation
- Sentiment Analysis
- Entity Recognition
- Classification
- Object Detection
- Semantic Segmentation
- Survey Research
- Data Entry
- Quality Assurance
- Other

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Annotation project created successfully",
  "data": {
    "project": {
      "_id": "6910d1789410dbfa4798df47",
      "projectName": "Image Classification for Self-Driving Cars",
      "projectDescription": "Classify and annotate objects...",
      "projectCategory": "Image Annotation",
      "payRate": 30,
      "payRateCurrency": "USD",
      "payRateType": "per_hour",
      "status": "active",
      "maxAnnotators": 5,
      "createdBy": {
        "_id": "69105d39c4a9bb94d5bcae10",
        "fullName": "Admin Name",
        "email": "admin@mydeeptech.ng"
      },
      "assignedAdmins": [...],
      "totalApplications": 0,
      "approvedAnnotators": 0,
      "createdAt": "2025-11-09T17:38:00.581Z",
      "updatedAt": "2025-11-09T17:38:00.581Z"
    }
  }
}
```

---

### 2. Get All Projects
**GET** `/admin/projects`

Retrieve all annotation projects with pagination and filtering.

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (active, completed, paused, cancelled)
- `category` (optional): Filter by project category
- `search` (optional): Search in project name/description

#### Example Request
```
GET /admin/projects?page=1&limit=20&status=active&category=Image%20Annotation
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Projects retrieved successfully",
  "data": {
    "projects": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalProjects": 25,
      "projectsPerPage": 10
    },
    "summary": {
      "totalProjects": 25,
      "activeProjects": 15,
      "completedProjects": 8,
      "pausedProjects": 2
    }
  }
}
```

---

### 3. Get Project Details
**GET** `/admin/projects/:projectId`

Get detailed information about a specific project including statistics.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "project": {
      "_id": "6910d1789410dbfa4798df47",
      "projectName": "Image Classification Project",
      "projectDescription": "...",
      "createdBy": {
        "fullName": "Admin Name",
        "email": "admin@mydeeptech.ng"
      },
      "assignedAdmins": [...],
      "status": "active",
      "totalApplications": 12,
      "approvedAnnotators": 3,
      "availableSlots": 2
    },
    "statistics": {
      "totalApplications": 12,
      "pendingApplications": 5,
      "approvedApplications": 3,
      "availableSlots": 2
    }
  }
}
```

---

### 4. Update Project
**PATCH** `/admin/projects/:projectId`

Update project details (partial updates supported).

#### Request Body (all fields optional)
```json
{
  "projectName": "Updated Project Name",
  "projectDescription": "Updated description",
  "status": "paused",
  "payRate": 35.00,
  "maxAnnotators": 8
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Annotation project updated successfully",
  "data": {
    "project": {...},
    "fieldsUpdated": ["projectName", "payRate", "maxAnnotators"]
  }
}
```

---

### 5. Delete Project
**DELETE** `/admin/projects/:projectId`

Delete a project (only if no active applications).

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Annotation project deleted successfully"
}
```

---

### 6. Get All Applications
**GET** `/admin/applications`

Retrieve all project applications with filtering and pagination.

#### Query Parameters
- `status` (optional): pending, approved, rejected
- `projectId` (optional): Filter by specific project
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

#### Example Request
```
GET /admin/applications?status=pending&page=1&limit=10
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "applications": [
      {
        "_id": "application_id",
        "projectId": {
          "projectName": "Image Classification Project",
          "projectCategory": "Image Annotation",
          "payRate": 30
        },
        "applicantId": {
          "fullName": "John Doe",
          "email": "john@example.com",
          "skills": ["Image Annotation", "Computer Vision"]
        },
        "status": "pending",
        "coverLetter": "I have 3 years of experience...",
        "appliedAt": "2025-11-09T10:30:00.000Z",
        "availability": "part_time",
        "proposedRate": 30
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalApplications": 15,
      "applicationsPerPage": 10
    },
    "summary": {
      "statusBreakdown": {
        "pending": 8,
        "approved": 5,
        "rejected": 2
      },
      "totalApplications": 15
    }
  }
}
```

---

### 7. Approve Application
**PATCH** `/admin/applications/:applicationId/approve`

Approve a user's project application and send email notification.

#### Request Body
```json
{
  "reviewNotes": "Excellent experience and qualifications. Looking forward to working with you on this project!"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Application approved successfully",
  "data": {
    "applicationId": "application_id",
    "applicantName": "John Doe",
    "projectName": "Image Classification Project",
    "emailNotificationSent": true
  }
}
```

#### Email Notification
User receives professional approval email with:
- Project details
- Approval message
- Next steps
- Contact information

---

### 8. Reject Application
**PATCH** `/admin/applications/:applicationId/reject`

Reject a user's project application with reason and send email notification.

#### Request Body
```json
{
  "rejectionReason": "insufficient_experience",
  "reviewNotes": "Thank you for your interest. We require more advanced experience for this particular project. Please consider applying for beginner-level projects to build your portfolio."
}
```

#### Rejection Reasons
- `insufficient_experience`
- `project_full`
- `qualifications_mismatch`
- `other`

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Application rejected successfully",
  "data": {
    "applicationId": "application_id",
    "applicantName": "John Doe",
    "projectName": "Image Classification Project",
    "rejectionReason": "insufficient_experience",
    "emailNotificationSent": true
  }
}
```

---

## 👤 DTUser (Annotator) Endpoints

### 1. Browse Available Projects
**GET** `/auth/projects`

View all available projects for approved annotators.

#### Headers
```
Authorization: Bearer <user_token>
```

#### Query Parameters
- `category` (optional): Filter by project category
- `minPayRate` (optional): Minimum pay rate filter
- `maxPayRate` (optional): Maximum pay rate filter
- `difficultyLevel` (optional): Filter by difficulty
- `page` (optional): Page number
- `limit` (optional): Items per page

#### Example Request
```
GET /auth/projects?category=Image%20Annotation&minPayRate=25&difficultyLevel=intermediate
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "_id": "project_id",
        "projectName": "Image Classification Project",
        "projectDescription": "Classify images of cats and dogs...",
        "projectCategory": "Image Annotation",
        "payRate": 30,
        "payRateCurrency": "USD",
        "payRateType": "per_hour",
        "difficultyLevel": "intermediate",
        "requiredSkills": ["Image Annotation", "Computer Vision"],
        "deadline": "2025-12-31T23:59:59.000Z",
        "availableSlots": 2,
        "totalApplications": 8,
        "createdBy": {
          "fullName": "Project Admin",
          "email": "admin@mydeeptech.ng"
        },
        "hasApplied": false
      }
    ],
    "pagination": {...},
    "userStats": {
      "totalApplications": 5,
      "activeProjects": 2,
      "completedProjects": 8
    }
  }
}
```

---

### 2. Apply to Project
**POST** `/auth/projects/:projectId/apply`

Submit an application to join a project.

#### Request Body
```json
{
  "coverLetter": "I have 3 years of experience in image annotation and computer vision. I've worked on similar projects involving object detection and classification. I'm particularly interested in autonomous vehicle applications and believe my skills would be valuable for this project.",
  "availability": "part_time",
  "proposedRate": 30,
  "estimatedCompletionTime": "3-4 weeks"
}
```

#### Field Descriptions
- `coverLetter` (required): Application message (max 1000 chars)
- `availability`: full_time, part_time, flexible
- `proposedRate` (optional): Counter-offer for pay rate
- `estimatedCompletionTime` (optional): Time estimate

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "application": {
      "_id": "application_id",
      "projectId": "project_id",
      "projectName": "Image Classification Project",
      "status": "pending",
      "appliedAt": "2025-11-09T15:30:00.000Z",
      "coverLetter": "I have 3 years of experience...",
      "availability": "part_time"
    },
    "emailNotificationSent": true
  }
}
```

#### Email Notifications
- **Admin receives**: Application notification with user details
- **Includes**: Project info, applicant profile, cover letter

---

### 3. Get Active Projects
**GET** `/auth/activeProjects/:userId`

Retrieve user's active and applied projects.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "activeProjects": [
      {
        "projectId": {
          "_id": "project_id",
          "projectName": "Text Sentiment Analysis",
          "projectCategory": "Text Annotation",
          "payRate": 25,
          "deadline": "2025-12-15T23:59:59.000Z"
        },
        "status": "approved",
        "appliedAt": "2025-11-05T10:00:00.000Z",
        "approvedAt": "2025-11-06T14:30:00.000Z",
        "workStartedAt": "2025-11-06T14:30:00.000Z",
        "coverLetter": "My application message...",
        "reviewNotes": "Great experience, welcome aboard!"
      }
    ],
    "pendingApplications": [
      {
        "projectId": {...},
        "status": "pending",
        "appliedAt": "2025-11-08T16:20:00.000Z",
        "coverLetter": "Another application..."
      }
    ],
    "statistics": {
      "totalApplications": 8,
      "activeProjects": 3,
      "pendingApplications": 2,
      "rejectedApplications": 1,
      "completedProjects": 2
    }
  }
}
```

---

## 📧 Email Notifications

### Admin Notifications
**From**: projects@mydeeptech.ng

#### New Application Alert
Sent when a user applies to a project.

**Subject**: "New Application for [Project Name]"

**Content**:
- Applicant information
- Project details
- Cover letter
- Links to approve/reject

### User Notifications

#### Application Approved
**Subject**: "Congratulations! Your application for [Project Name] has been approved"

**Content**:
- Project details
- Approval message
- Next steps
- Contact information

#### Application Rejected
**Subject**: "Application Update for [Project Name]"

**Content**:
- Polite rejection message
- Reason for rejection
- Encouragement and feedback
- Other opportunity suggestions

---

## 🚫 Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["projectName is required", "payRate must be greater than 0"]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Admin access token required",
  "code": "ADMIN_TOKEN_MISSING"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin privileges required. Access denied.",
  "code": "ADMIN_ACCESS_DENIED"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Project not found"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Server error creating annotation project",
  "error": "Detailed error message"
}
```

---

## 📋 Usage Examples

### Complete Workflow Example

```javascript
// 1. Admin creates project
const project = await axios.post('/api/admin/projects', {
  projectName: 'AI Training Data Annotation',
  projectDescription: 'Annotate images for machine learning model training',
  projectCategory: 'Image Annotation',
  payRate: 25,
  maxAnnotators: 10
}, { headers: { Authorization: `Bearer ${adminToken}` }});

// 2. User browses projects
const projects = await axios.get('/api/auth/projects', {
  headers: { Authorization: `Bearer ${userToken}` }
});

// 3. User applies to project
const application = await axios.post(`/api/auth/projects/${projectId}/apply`, {
  coverLetter: 'I have relevant experience...',
  availability: 'part_time'
}, { headers: { Authorization: `Bearer ${userToken}` }});

// 4. Admin views applications
const applications = await axios.get('/api/admin/applications?status=pending', {
  headers: { Authorization: `Bearer ${adminToken}` }
});

// 5. Admin approves application
await axios.patch(`/api/admin/applications/${applicationId}/approve`, {
  reviewNotes: 'Welcome to the project!'
}, { headers: { Authorization: `Bearer ${adminToken}` }});

// 6. User checks active projects
const activeProjects = await axios.get(`/api/auth/activeProjects/${userId}`, {
  headers: { Authorization: `Bearer ${userToken}` }
});
```

---

## 🔍 Testing

Use the provided test files:
- `test-project-system.js` - Complete workflow test
- `quick-project-test.js` - Simple project creation test

```bash
# Start server
node index.js

# Run comprehensive test
node test-project-system.js

# Run quick test
node quick-project-test.js
```

---

## 🛠️ Configuration

### Required Environment Variables
```bash
JWT_SECRET=your-jwt-secret
MONGODB_URI=your-mongodb-connection
BREVO_API_KEY=your-brevo-api-key
```

### Admin Email Configuration
- Projects: projects@mydeeptech.ng
- System: no-reply@mydeeptech.ng

---

This documentation covers all endpoints in the project management system with complete request/response examples, error handling, and usage patterns.