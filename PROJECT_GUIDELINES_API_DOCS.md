# Project Guidelines System - API Documentation

## Overview

This enhancement adds project guidelines functionality to the annotation project system, allowing administrators to provide detailed guidelines to approved annotators and ensuring proper access control.

## Features Added

### 1. Project Model Enhancement
- **projectGuidelineLink** (required): URL to project guidelines document
- **projectGuidelineVideo** (optional): URL to video tutorial/guidelines

### 2. Access Control
- Only approved annotators can access project guidelines
- Endpoint validates user has approved application for specific project

### 3. Email Integration
- Approval emails now include project guidelines links
- Enhanced email template with clear guideline section

---

## API Endpoints

### 1. Admin: Create Annotation Project (Enhanced)
**Endpoint:** `POST /admin/projects`

**New Required Fields:**
```json
{
  "projectName": "Customer Support Classification",
  "projectDescription": "Classify customer support tickets by urgency and category",
  "projectCategory": "Text Annotation",
  "payRate": 15,
  "projectGuidelineLink": "https://docs.google.com/document/d/abc123/edit",
  "projectGuidelineVideo": "https://youtube.com/watch?v=def456",
  "projectCommunityLink": "https://discord.gg/project-community",
  // ... other existing fields
}
```

**Validation:**
- `projectGuidelineLink`: Required, must be valid URL
- `projectGuidelineVideo`: Optional, must be valid URL if provided
- `projectCommunityLink`: Optional, must be valid URL if provided

---

### 2. User: Get Project Guidelines (New Endpoint)
**Endpoint:** `GET /api/projects/{projectId}/guidelines`

**Authentication:** Required (User token)

**Access Control:** Only approved annotators for the specific project

#### Success Response (200)
```json
{
  "success": true,
  "message": "Project guidelines retrieved successfully",
  "data": {
    "projectInfo": {
      "id": "64a1b2c3d4e5f6789012345",
      "name": "Customer Support Classification",
      "description": "Classify customer support tickets by urgency and category",
      "category": "Text Annotation",
      "payRate": 15,
      "payRateCurrency": "USD",
      "payRateType": "per_task",
      "difficultyLevel": "intermediate",
      "deadline": "2024-02-15T23:59:59.000Z"
    },
    "guidelines": {
      "documentLink": "https://docs.google.com/document/d/abc123/edit",
      "videoLink": "https://youtube.com/watch?v=def456",
      "communityLink": "https://discord.gg/project-community"
    },
    "userApplication": {
      "appliedAt": "2024-01-15T10:30:00.000Z",
      "approvedAt": "2024-01-16T14:20:00.000Z",
      "workStartedAt": "2024-01-16T14:20:00.000Z",
      "status": "approved"
    },
    "accessInfo": {
      "accessGrantedAt": "2024-01-17T09:15:00.000Z",
      "accessType": "approved_annotator",
      "userRole": "annotator"
    }
  }
}
```

#### Error Responses

**403 Forbidden - Not Approved:**
```json
{
  "success": false,
  "message": "Access denied. Only approved annotators can access project guidelines.",
  "error": {
    "code": "GUIDELINES_ACCESS_DENIED",
    "reason": "User must have an approved application for this project",
    "userStatus": "not_approved_for_project"
  }
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Project not found"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Authentication required to access project guidelines"
}
```

---

## Email Enhancement

### Approval Email Template Updates

The approval notification email now includes a prominent guidelines section:

**New Email Features:**
- **Guidelines Document Link** (required): Direct link to project guidelines
- **Video Tutorial Link** (optional): Link to supplementary video content
- **Clear Visual Hierarchy**: Guidelines section stands out with distinct styling
- **Warning Notice**: Emphasizes importance of following guidelines

**Email Structure:**
1. Congratulations header
2. Project details
3. **NEW: Project Guidelines Section**
   - Required guidelines document link
   - Optional video tutorial link
   - Warning about guideline compliance
4. Next steps (updated to prioritize guideline review)
5. Dashboard access button

---

## Database Schema Updates

### AnnotationProject Model Changes

```javascript
// New fields added to annotationProject.model.js
{
  // Project guidelines and resources
  projectGuidelineLink: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Project guideline link must be a valid URL'
    }
  },
  projectGuidelineVideo: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Project guideline video must be a valid URL'
    },
    default: null
  }
}
```

---

## Usage Examples

### 1. Admin Creating Project with Guidelines

```javascript
// POST /admin/projects
const projectData = {
  projectName: "Medical Image Annotation",
  projectDescription: "Annotate medical images for disease classification",
  projectCategory: "Image Annotation",
  payRate: 25,
  payRateCurrency: "USD",
  payRateType: "per_task",
  maxAnnotators: 10,
  difficultyLevel: "advanced",
  requiredSkills: ["Medical Knowledge", "Image Analysis"],
  projectGuidelineLink: "https://drive.google.com/document/d/medical-annotation-guidelines",
  projectGuidelineVideo: "https://vimeo.com/medical-annotation-training"
};
```

### 2. User Accessing Guidelines After Approval

```javascript
// GET /api/projects/64a1b2c3d4e5f6789012345/guidelines
// Headers: { Authorization: "Bearer <user_token>" }

// Only works if user has approved application for this project
```

### 3. Frontend Integration Example

```javascript
// Check if user can access guidelines
const checkGuidelinesAccess = async (projectId) => {
  try {
    const response = await fetch(`/api/projects/${projectId}/guidelines`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      // Show guidelines links
      showGuidelines(data.guidelines);
    } else if (response.status === 403) {
      // User not approved - show access denied message
      showAccessDenied();
    }
  } catch (error) {
    console.error('Guidelines access check failed:', error);
  }
};
```

---

## Security Features

### 1. Access Control
- **Authentication Required**: All endpoints require valid user tokens
- **Application Validation**: System checks for approved application status
- **Project-Specific Access**: Users can only access guidelines for projects they're approved for

### 2. Data Validation
- **URL Validation**: All guideline links validated as proper URLs
- **Required Field Enforcement**: Guidelines document link is mandatory
- **Input Sanitization**: All URLs are trimmed and validated

### 3. Audit Trail
- **Access Logging**: All guideline access attempts logged with timestamps
- **User Identification**: Tracks which user accessed which project guidelines
- **Status Verification**: Confirms user approval status before granting access

---

## Error Handling

### Common Error Scenarios

1. **Unauthenticated User**
   - Status: 401
   - Action: Redirect to login

2. **User Not Approved for Project**
   - Status: 403
   - Action: Show application status or apply button

3. **Project Not Found**
   - Status: 404
   - Action: Show project not found message

4. **Invalid Guidelines URL**
   - Status: 400
   - Action: Show validation error in admin panel

5. **Server Error**
   - Status: 500
   - Action: Show generic error message, log details

---

## Testing Guidelines

### 1. Admin Tests
- Create project with required guideline link
- Create project with optional video link
- Test URL validation for invalid links
- Update project with new guidelines

### 2. User Access Tests
- Approved user accessing guidelines (should succeed)
- Non-approved user accessing guidelines (should fail with 403)
- User accessing non-existent project (should fail with 404)
- Unauthenticated access (should fail with 401)

### 3. Email Tests
- Verify approval emails include guideline links
- Test email rendering with and without video links
- Confirm links are clickable and properly formatted

---

## Migration Notes

### For Existing Projects
- **Backward Compatibility**: Existing projects without guidelines will need to be updated
- **Admin Action Required**: Administrators must add guideline links to existing projects
- **User Impact**: Users with existing approvals will gain access to guidelines once added

### Database Migration
- Add new fields to existing annotation projects
- Set default values for guideline links (may require admin update)
- Validate existing URLs if any projects already have guideline fields

---

## Future Enhancements

### Planned Features
1. **Guideline Versioning**: Track changes to project guidelines
2. **Read Confirmation**: Require users to confirm they've read guidelines
3. **Inline Guidelines**: Allow guidelines to be stored directly in database
4. **Multi-language Support**: Support guidelines in multiple languages
5. **Analytics**: Track guideline access and user engagement

### Integration Opportunities
1. **Learning Management System**: Integration with training platforms
2. **Progress Tracking**: Monitor user progress through guidelines
3. **Assessment Integration**: Quiz users on guideline understanding
4. **Feedback System**: Allow users to provide feedback on guideline clarity

---

## Support and Troubleshooting

### Common Issues

1. **Guidelines Not Loading**
   - Check user approval status
   - Verify project exists
   - Confirm valid authentication token

2. **Invalid URL Errors**
   - Ensure URLs include http:// or https://
   - Verify URLs are accessible
   - Check for proper formatting

3. **Email Not Received**
   - Check spam folder
   - Verify email configuration
   - Confirm approval process completed

### Contact Information
- **Technical Support**: tech@mydeeptech.ng
- **Project Administration**: projects@mydeeptech.ng
- **Documentation**: docs@mydeeptech.ng