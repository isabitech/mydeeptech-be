# Task Application Rejection Email Notification

## Feature Overview

When an admin rejects a task application, the system automatically sends a professional email notification to the applicant explaining why their application was rejected.

## API Usage

### Endpoint

```
POST /api/task/approve-reject-application
```

### Request Body

```json
{
  "applicationId": "64a1b2c3d4e5f6789abcdef0",
  "action": "reject",
  "rejectionReason": "Your portfolio doesn't demonstrate sufficient experience with this type of task. Please consider applying for beginner-level tasks to build your skills."
}
```

### Parameters

- `applicationId` (required): The ID of the task application
- `action` (required): "approve" or "reject"
- `rejectionReason` (optional): Specific reason for rejection - helps provide feedback to the applicant

### Response

```json
{
  "success": true,
  "message": "Application rejected successfully.",
  "data": {
    "task": "...",
    "applicant": "...",
    "status": "rejected"
  }
}
```

## Email Content

The rejection email includes:

- Personal greeting using applicant's name
- Professional rejection message
- Task details (title and category)
- Specific rejection reason (if provided)
- Encouragement to apply for other tasks
- Support contact information

## Implementation Notes

### Error Handling

- If email sending fails, the application is still marked as rejected
- Email errors are logged but don't affect the core functionality
- Missing applicant data is handled gracefully

### Email Template

Located at: `emailTemplates/sendTaskApplicationRejectionNotification.html`

- Responsive design
- MyDeepTech branding
- Professional tone

### Dependencies

- Uses existing `ProjectMailService`
- Requires populated `applicant` field with email
- Uses configured SMTP settings

## Testing

Use the test script to verify email functionality:

```bash
cd mydeeptech-be
node scripts/test-task-rejection-email.js
```

## Best Practices

### Writing Rejection Reasons

- Be specific and constructive
- Explain why the application was rejected
- Suggest improvements or alternatives
- Maintain a professional, encouraging tone

### Examples of Good Rejection Reasons:

```
"Your portfolio shows great potential, but we need someone with specific experience in medical image annotation for this task."

"This task requires advanced computer vision skills. Consider applying for our beginner-level labeling tasks to build your experience."

"Your application was strong, but we selected candidates with domain expertise in autonomous vehicles for this specific project."
```

### Examples to Avoid:

```
"Not qualified" (too vague)
"Application rejected" (no helpful information)
"Try again later" (doesn't provide guidance)
```

## Monitoring

- Email sending status is logged to console
- Failed emails are logged as errors
- Application rejection always succeeds regardless of email status

## Related Files

- Controller: `controllers/task.controller.js`
- Service: `services/mail-service/project.service.js`
- Template: `emailTemplates/sendTaskApplicationRejectionNotification.html`
- Test: `scripts/test-task-rejection-email.js`
