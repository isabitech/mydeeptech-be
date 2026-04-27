# Application Expiry Feature

## Overview

This feature allows projects to automatically expire and reject applications after a specified duration. When creating or updating a project, admins can set an optional duration (1-4 weeks), and applications to that project will be automatically rejected after the expiry date.

## How It Works

1. **Project Creation/Update**: Admin sets optional `applicationDuration` (1, 2, 3, or 4 weeks)
2. **Application Creation**: When users apply, system calculates `expiryDate = applicationDate + projectDuration`
3. **Auto-Rejection**: Scheduled job automatically rejects applications after their expiry date

## Features

### 🎯 Frontend Features

- Optional duration field in project creation/update form
- Dropdown with options: 1 Week, 2 Weeks, 3 Weeks, 4 Weeks (1 Month)
- Clear labeling and help text for user guidance

### ⚙️ Backend Features

- `applicationDuration` field in project model (1, 2, 3, or 4 weeks)
- `expiryDate` field in application model
- Automatic expiry date calculation during application creation
- Scheduled job for processing expired applications
- Email notifications to rejected applicants
- Admin endpoints for manual processing and monitoring

### 📧 Email Notifications

- Automated expiry notification emails
- Professional template with clear explanation
- Encouragement to apply to other projects

## Database Changes

### Project Model (`annotationProject.model.js`)

```javascript
applicationDuration: {
  type: Number,
  enum: [1, 2, 3, 4], // weeks
  default: null // null means no auto-expiry
}
```

### Application Model (`projectApplication.model.js`)

```javascript
expiryDate: {
  type: Date,
  default: null // Set when project has applicationDuration
},
rejectionReason: {
  // Added "expired" to enum values
  enum: [..., "expired", ...]
}
```

## API Endpoints

### Admin Endpoints

- `POST /admin/applications/process-expired` - Manually trigger expiry processing
- `GET /admin/applications/expiry-statistics?days=30` - Get expiry statistics
- `GET /admin/applications/expiring-soon?hours=24` - Get applications expiring soon

### Response Examples

#### Process Expired Applications

```json
{
  "success": true,
  "message": "Expired applications processed successfully",
  "data": {
    "processedCount": 5,
    "errorCount": 0,
    "processedApplications": [...],
    "errors": [],
    "processedAt": "2024-04-27T..."
  }
}
```

#### Expiry Statistics

```json
{
  "success": true,
  "message": "Expiry statistics retrieved successfully",
  "data": {
    "totalExpiredLastNDays": 12,
    "dailyBreakdown": [...],
    "period": "30 days",
    "generatedAt": "2024-04-27T..."
  }
}
```

## Scheduled Processing

### Setup Cron Job

Add to crontab for automatic processing:

```bash
# Process every 6 hours
0 */6 * * * /usr/bin/node /path/to/mydeeptech-be/scripts/processExpiredApplications.js

# Or process daily at midnight
0 0 * * * /usr/bin/node /path/to/mydeeptech-be/scripts/processExpiredApplications.js
```

### Manual Processing

```bash
# Run the script manually
cd /path/to/mydeeptech-be
node scripts/processExpiredApplications.js
```

## Files Changed

### Backend

- `models/annotationProject.model.js` - Added `applicationDuration` field
- `models/projectApplication.model.js` - Added `expiryDate` and "expired" rejection reason
- `services/annotationProject.service.js` - Updated application creation logic
- `services/applicationExpiry.service.js` - New service for expiry processing
- `scripts/processExpiredApplications.js` - Scheduled job script
- `controllers/admin.controller.js` - Added expiry management endpoints
- `routes/admin.js` - Added expiry processing routes

### Frontend

- `src/types/project.types.ts` - Added `applicationDuration` to Project and CreateProjectForm interfaces
- `src/pages/Dashboard/Admin/projectmgt/NewProjectManagement.tsx` - Added duration field to form

## Testing

### 1. Frontend Testing

1. Go to Admin Project Management page
2. Create or edit a project
3. Set "Application Duration" to 1-4 weeks
4. Verify field saves correctly

### 2. Backend Testing

1. Create a project with `applicationDuration: 1` (1 week)
2. Have a user apply to the project
3. Verify application has `expiryDate` set to 1 week from now
4. Run processing script to test expiry logic

### 3. Scheduled Job Testing

```bash
# Test the processing script
cd mydeeptech-be
node scripts/processExpiredApplications.js
```

## User Experience

### For Admins

- Optional feature - projects without duration work as before
- Clear dropdown with week options
- Access to expiry statistics and monitoring
- Manual processing capability

### For Applicants

- Transparent process - applications expire based on project policy
- Professional email notification when application expires
- Encouragement to apply to other projects
- No impact on projects without expiry duration

## Benefits

1. **Improved Processing Efficiency**: Applications don't sit pending indefinitely
2. **Better Resource Management**: Focus on recent, relevant applications
3. **User Expectation Management**: Clear timeline for application validity
4. **Automated Workflow**: Reduces manual admin overhead
5. **Professional Communication**: Proper notification when applications expire

## Future Enhancements

- Configurable expiry duration (not limited to weeks)
- Warning emails before expiry
- Analytics dashboard for expiry trends
- Project-specific expiry policies
- Bulk expiry management tools
