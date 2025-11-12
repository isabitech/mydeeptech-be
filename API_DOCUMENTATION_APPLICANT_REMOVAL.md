# Remove Approved Applicants API Documentation

## Overview
This API provides functionality for administrators to remove already approved applicants from annotation projects. This is useful when applicants need to be removed after approval due to performance issues, project changes, or other administrative decisions.

## Endpoints

### 1. Remove Approved Applicant
**Endpoint:** `DELETE /admin/applications/:applicationId/remove`

**Description:** Removes an approved applicant from a project and updates their status to "removed"

**Authentication:** Admin only (requires `authenticateAdmin` middleware)

**Parameters:**
- `applicationId` (URL parameter) - The ID of the application to remove

**Request Body:**
```json
{
  "reason": "performance_issues", // Required
  "notes": "Optional removal notes explaining the decision" // Optional
}
```

**Valid Removal Reasons:**
- `performance_issues`
- `project_cancelled`
- `violates_guidelines`
- `unavailable`
- `quality_concerns`
- `admin_decision`
- `other`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Approved applicant removed successfully",
  "data": {
    "applicationId": "64f8a1b2c3d4e5f6789",
    "applicantName": "John Doe",
    "applicantEmail": "john.doe@example.com",
    "projectName": "Text Classification Project",
    "previousStatus": "approved",
    "newStatus": "removed",
    "removalReason": "performance_issues",
    "removalNotes": "Consistently missed deadlines",
    "workPeriod": {
      "startDate": "2024-01-15T10:00:00.000Z",
      "endDate": "2024-01-22T15:30:00.000Z",
      "totalDays": 7
    },
    "removedBy": {
      "id": "64f8a1b2c3d4e5f6790",
      "name": "Admin User",
      "email": "admin@mydeeptech.ng"
    },
    "removedAt": "2024-01-22T15:30:00.000Z",
    "projectUpdates": {
      "currentAnnotators": 4,
      "maxAnnotators": 5,
      "spotsAvailable": 1
    },
    "notificationsSent": {
      "applicantNotified": true,
      "adminNotified": true
    }
  }
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Validation error message",
  "errors": ["Reason is required", "Invalid removal reason"]
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Application not found or not eligible for removal"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Failed to remove applicant",
  "error": "Error details"
}
```

### 2. Get Removable Applicants
**Endpoint:** `GET /admin/projects/:projectId/removable-applicants`

**Description:** Get a list of approved applicants who can be removed from a specific project

**Authentication:** Admin only (requires `authenticateAdmin` middleware)

**Parameters:**
- `projectId` (URL parameter) - The ID of the project

**Success Response (200):**
```json
{
  "success": true,
  "message": "Removable applicants retrieved successfully",
  "data": {
    "projectId": "64f8a1b2c3d4e5f6788",
    "projectName": "Text Classification Project",
    "totalApprovedApplicants": 5,
    "removableApplicants": [
      {
        "applicationId": "64f8a1b2c3d4e5f6789",
        "applicantId": "64f8a1b2c3d4e5f6787",
        "applicantName": "John Doe",
        "applicantEmail": "john.doe@example.com",
        "approvedAt": "2024-01-15T10:00:00.000Z",
        "workStartedAt": "2024-01-15T10:00:00.000Z",
        "daysSinceApproval": 7,
        "tasksCompleted": 12,
        "qualityScore": 85
      },
      {
        "applicationId": "64f8a1b2c3d4e5f6790",
        "applicantId": "64f8a1b2c3d4e5f6788",
        "applicantName": "Jane Smith",
        "applicantEmail": "jane.smith@example.com",
        "approvedAt": "2024-01-16T09:30:00.000Z",
        "workStartedAt": "2024-01-16T09:30:00.000Z",
        "daysSinceApproval": 6,
        "tasksCompleted": 8,
        "qualityScore": 92
      }
    ]
  }
}
```

**Error Responses:**

**404 Not Found:**
```json
{
  "success": false,
  "message": "Project not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Failed to fetch removable applicants",
  "error": "Error details"
}
```

## Data Model Changes

### ProjectApplication Model Updates
The `ProjectApplication` model has been extended with the following new fields:

```javascript
// Removal tracking (for removed approved applicants)
removedAt: {
  type: Date,
  default: null
},
removedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'DTUser',
  default: null
},
removalReason: {
  type: String,
  enum: [
    "performance_issues",
    "project_cancelled", 
    "violates_guidelines",
    "unavailable",
    "quality_concerns",
    "admin_decision",
    "other"
  ],
  default: null
},
removalNotes: {
  type: String,
  maxlength: 500,
  default: ""
}
```

### Status Enum Update
The status field now includes the "removed" status:
```javascript
status: {
  type: String,
  enum: ["pending", "approved", "rejected", "removed"],
  default: "pending"
}
```

## Email Notifications

### Applicant Removal Notification
Sent to the removed applicant with:
- Project details
- Removal reason and notes
- Work period summary
- Encouragement to apply to other projects

### Admin Notification
Sent to project admin with:
- Removed applicant details
- Removal reason and admin notes
- Work progress summary
- Project capacity updates

## Business Logic

### Removal Eligibility
Only applications with status "approved" can be removed.

### Project Counter Updates
When an applicant is removed:
- `currentAnnotators` count is decremented
- Project capacity becomes available for new applicants

### Work Period Calculation
The system calculates the total work period from approval to removal date.

### Audit Trail
All removal actions are logged with:
- Who performed the removal
- When the removal occurred
- Reason and notes
- Original application data preservation

## Security Considerations

1. **Admin Authentication**: Only authenticated administrators can access these endpoints
2. **Input Validation**: All inputs are validated using Joi schemas
3. **Data Preservation**: Original application data is preserved for audit purposes
4. **Email Notifications**: Both parties are notified of the removal action
5. **Reversibility**: While status changes to "removed", original data remains for potential review

## Usage Examples

### Remove an Applicant
```javascript
const response = await fetch('/admin/applications/64f8a1b2c3d4e5f6789/remove', {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <admin-token>'
  },
  body: JSON.stringify({
    reason: 'performance_issues',
    notes: 'Consistently missed deadlines and quality standards'
  })
});

const result = await response.json();
```

### Get Removable Applicants
```javascript
const response = await fetch('/admin/projects/64f8a1b2c3d4e5f6788/removable-applicants', {
  headers: {
    'Authorization': 'Bearer <admin-token>'
  }
});

const result = await response.json();
```

## Error Handling

The API implements comprehensive error handling:
- Input validation errors
- Database operation errors  
- Email sending failures (logged but don't block the removal)
- Authentication and authorization errors
- Resource not found errors

## Performance Considerations

- Database queries are optimized with proper indexing
- Email sending is handled asynchronously
- Large result sets are paginated if needed
- Proper error logging for monitoring

## Integration Notes

This functionality integrates with:
- Existing admin authentication system
- Project management workflows
- Email notification system
- Audit logging system
- User dashboard updates

## Future Enhancements

Potential future improvements:
- Batch removal operations
- Removal approval workflow
- Enhanced reporting and analytics
- Integration with performance metrics
- Automated removal based on quality scores