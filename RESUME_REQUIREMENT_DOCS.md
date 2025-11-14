# Resume Requirement for Project Applications

## Overview

The project application system now requires annotators to have a resume uploaded to their profile before they can apply to any annotation projects. This ensures that admins have access to applicant qualifications when reviewing applications.

## Implementation Details

### 1. Database Changes

#### User Model (`dtUser.model.js`)
- The user model already includes an `attachments.resume_url` field
- This field stores the URL of the uploaded resume document

#### Project Application Model (`projectApplication.model.js`)
- Added `resumeUrl` field (required)
- This field stores the resume URL at the time of application
- Ensures that admin has access to the resume even if user changes it later

```javascript
// New field in ProjectApplication schema
resumeUrl: {
  type: String,
  required: true // Resume is now required for all applications
}
```

### 2. Application Controller Changes

#### Resume Validation (`dtUser.controller.js`)
The `applyToProject` function now includes resume validation:

```javascript
// Check if user has uploaded their resume
if (!user.attachments?.resume_url || user.attachments.resume_url.trim() === '') {
  console.log(`❌ User ${req.user.email} application denied - No resume uploaded`);
  return res.status(400).json({
    success: false,
    message: "Please upload your resume in your profile section",
    error: {
      code: "RESUME_REQUIRED",
      reason: "A resume is required to apply to projects",
      action: "Upload your resume in the profile section before applying"
    }
  });
}
```

#### Application Creation
When creating a successful application, the resume URL is now included:

```javascript
const application = new ProjectApplication({
  projectId: projectId,
  applicantId: userId,
  coverLetter: coverLetter || "",
  resumeUrl: user.attachments.resume_url, // Resume URL from user profile
  proposedRate: proposedRate || project.payRate,
  availability: availability || "flexible",
  estimatedCompletionTime: estimatedCompletionTime || "",
  status: 'pending'
});
```

### 3. Email Notifications

#### Admin Notification Enhancement
The email notification sent to admins when someone applies to their project now includes a direct link to the applicant's resume:

**HTML Email Template:**
```html
<tr>
    <td style="padding: 8px 0; font-weight: bold;">Resume:</td>
    <td style="padding: 8px 0;">
        <a href="${resumeUrl}" target="_blank" style="color: #007bff; text-decoration: none; font-weight: bold;">
            📄 View Resume
        </a>
    </td>
</tr>
```

**Text Email Template:**
```
- Resume: ${resumeUrl}
```

## API Responses

### Successful Application
When an annotator with a resume applies successfully:

```json
{
  "success": true,
  "message": "Application submitted successfully",
  "data": {
    "application": {
      "_id": "application_id",
      "projectId": "project_id",
      "applicantId": "user_id",
      "resumeUrl": "https://example.com/resume.pdf",
      "status": "pending",
      "appliedAt": "2025-11-14T17:36:35.203Z"
    },
    "projectName": "Project Name"
  }
}
```

### Failed Application (No Resume)
When an annotator without a resume tries to apply:

```json
{
  "success": false,
  "message": "Please upload your resume in your profile section",
  "error": {
    "code": "RESUME_REQUIRED",
    "reason": "A resume is required to apply to projects",
    "action": "Upload your resume in the profile section before applying"
  }
}
```

## Validation Flow

1. **User Authentication**: Verify user is logged in and approved annotator
2. **Resume Check**: Verify `user.attachments.resume_url` exists and is not empty
3. **Project Validation**: Verify project exists, is active, and accepting applications
4. **Application Creation**: Include resume URL in application record
5. **Email Notification**: Send resume link to admins for review

## Frontend Integration

### Error Handling
Frontend applications should handle the `RESUME_REQUIRED` error code specifically:

```javascript
if (error.response?.data?.error?.code === 'RESUME_REQUIRED') {
  // Redirect user to profile page to upload resume
  router.push('/profile?section=attachments');
  showError('Please upload your resume before applying to projects');
}
```

### Pre-Application Check
Before showing the application form, check if user has a resume:

```javascript
const canApply = user.attachments?.resume_url && user.attachments.resume_url.trim() !== '';
if (!canApply) {
  showWarning('Please upload your resume in your profile before applying');
}
```

## Testing

### Test Files
- `test-resume-validation.js`: Comprehensive testing of the resume requirement feature
- `test-apply-endpoint.js`: Updated to include resume validation testing

### Test Coverage
- ✅ User creation with and without resume
- ✅ Application validation (should fail without resume)
- ✅ Application creation (should succeed with resume) 
- ✅ Email data preparation with resume URL
- ✅ Database model validation
- ✅ API response formatting

## Database Migration

### Existing Applications
Existing applications in the database may not have the `resumeUrl` field. To handle this:

1. **Gradual Migration**: The field is required for new applications but existing ones remain valid
2. **Data Backfill**: Run a migration script to populate missing resume URLs from user profiles
3. **Admin Interface**: Show "Resume not available" for older applications without resume URLs

### Migration Script Example
```javascript
// Update existing applications with resume URLs
const applications = await ProjectApplication.find({ resumeUrl: { $exists: false } });
for (const app of applications) {
  const user = await DTUser.findById(app.applicantId);
  if (user?.attachments?.resume_url) {
    app.resumeUrl = user.attachments.resume_url;
    await app.save();
  }
}
```

## Security Considerations

1. **URL Validation**: Resume URLs should be validated to ensure they're legitimate file hosting URLs
2. **Access Control**: Resume URLs should only be accessible to admins and the user who uploaded them
3. **File Type Validation**: Resume uploads should be restricted to PDF, DOC, DOCX formats
4. **Virus Scanning**: Uploaded resume files should be scanned for malware

## Future Enhancements

1. **Resume Version Control**: Track when resume was last updated
2. **Resume Requirements per Project**: Allow projects to specify specific resume requirements
3. **Automatic Resume Parsing**: Extract skills and experience data from resumes
4. **Resume Templates**: Provide standardized resume templates for annotators
5. **Resume Analytics**: Track which resume formats lead to higher approval rates

## API Endpoints Affected

- `POST /api/auth/projects/:projectId/apply` - Now requires resume in user profile
- `GET /api/admin/projects/applications` - Returns resume URLs for admin review
- `PUT /api/auth/profile` - Resume upload endpoint becomes more critical

## Error Codes

| Code | Message | Action |
|------|---------|--------|
| `RESUME_REQUIRED` | Please upload your resume in your profile section | Upload resume before applying |
| `INVALID_RESUME_URL` | Resume URL is invalid or inaccessible | Re-upload resume with valid file |
| `RESUME_FILE_TOO_LARGE` | Resume file exceeds size limit | Compress or optimize resume file |

This implementation ensures that all project applications include the necessary documentation for proper evaluation while providing clear guidance to users about the requirements.