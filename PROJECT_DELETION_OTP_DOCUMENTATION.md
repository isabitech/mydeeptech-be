# Project Deletion with OTP Authorization Documentation

## Overview
This document explains the enhanced project deletion system that requires OTP (One-Time Password) authorization from the Projects Officer (projects@mydeeptech.ng) when attempting to delete projects that have active applications.

## Security Enhancement Rationale
Previously, any admin could delete projects even with active applications, potentially causing data loss and disrupting ongoing work. The new system ensures that:

1. **Projects Officer Authorization**: Only the Projects Officer can authorize deletion of projects with active applications
2. **OTP Verification**: A secure 6-digit OTP is sent to projects@mydeeptech.ng for verification
3. **Time-Limited Access**: OTP expires in 15 minutes to prevent misuse
4. **Audit Trail**: All deletion attempts and approvals are logged for security

---

## System Flow

### 1. Standard Project Deletion (No Active Applications)
**Endpoint**: `DELETE /api/admin/projects/:projectId`

- If project has no active applications → Deletes immediately
- No OTP required for projects without active applications
- Standard admin authentication required

### 2. Enhanced Deletion Process (With Active Applications)

#### Step 1: Request OTP Authorization
**Endpoint**: `POST /api/admin/projects/:projectId/request-deletion-otp`

#### Step 2: Verify OTP and Delete
**Endpoint**: `POST /api/admin/projects/:projectId/verify-deletion-otp`

---

## API Endpoints Documentation

### 1. Regular Project Deletion
```http
DELETE /api/admin/projects/:projectId
Authorization: Bearer <admin_jwt_token>
```

**Response when project has active applications:**
```json
{
  "success": false,
  "message": "Cannot delete project with X active applications. Please resolve all applications first or use force delete with OTP verification.",
  "data": {
    "activeApplications": 5,
    "requiresOTP": true,
    "projectName": "Image Classification Project",
    "projectId": "64f8a1b2c3d4e5f6a7b8c9d0"
  }
}
```

### 2. Request Deletion OTP

#### Endpoint
```http
POST /api/admin/projects/:projectId/request-deletion-otp
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "reason": "Project requirements changed, need to restart"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Deletion OTP sent to Projects Officer for approval",
  "data": {
    "projectName": "Image Classification Project",
    "projectId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "activeApplications": 5,
    "totalApplications": 12,
    "otpSentTo": "projects@mydeeptech.ng",
    "expiresAt": "2024-01-20T15:45:00.000Z",
    "requestedBy": "admin@mydeeptech.ng",
    "otpExpiryMinutes": 15
  }
}
```

#### Error Responses
```json
// Project not found
{
  "success": false,
  "message": "Annotation project not found"
}

// Email sending failed
{
  "success": false,
  "message": "Failed to send deletion OTP to Projects Officer",
  "error": "SMTP connection failed"
}
```

### 3. Verify OTP and Delete Project

#### Endpoint
```http
POST /api/admin/projects/:projectId/verify-deletion-otp
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "otp": "123456",
  "confirmationMessage": "Confirmed deletion with all applications removed"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Project deleted successfully with OTP verification",
  "data": {
    "deletedProject": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "name": "Image Classification Project",
      "category": "Image Annotation"
    },
    "deletedApplications": {
      "total": 12,
      "active": 5,
      "applications": [
        {
          "applicantName": "John Doe",
          "status": "approved",
          "appliedAt": "2024-01-15T10:00:00.000Z"
        }
      ]
    },
    "deletedBy": "admin@mydeeptech.ng",
    "deletedAt": "2024-01-20T15:30:00.000Z",
    "otpVerified": true,
    "confirmationSent": true
  }
}
```

#### Error Responses
```json
// Invalid OTP
{
  "success": false,
  "message": "Invalid OTP code. Please check and try again."
}

// Expired OTP
{
  "success": false,
  "message": "OTP has expired. Please request a new OTP."
}

// No OTP found
{
  "success": false,
  "message": "No deletion OTP found. Please request a new OTP first."
}

// Already used OTP
{
  "success": false,
  "message": "OTP has already been used. Please request a new OTP."
}
```

---

## Email Notifications

### 1. OTP Request Email (to Projects Officer)

**Recipient**: projects@mydeeptech.ng  
**Subject**: 🚨 PROJECT DELETION AUTHORIZATION REQUIRED - [Project Name]

**Content includes:**
- Project details (name, ID, category)
- Number of applications (total and active)
- Requesting administrator information
- 6-digit OTP code with 15-minute expiry
- Detailed warning about deletion consequences
- Security information and authorization instructions

### 2. Deletion Confirmation Email (to Projects Officer)

**Recipient**: projects@mydeeptech.ng  
**Subject**: ✅ PROJECT DELETION COMPLETED - [Project Name]

**Content includes:**
- Deletion summary with timestamps
- List of deleted applications and applicants
- Security audit information
- Confirmation that action is completed

---

## Database Schema Updates

### AnnotationProject Model Enhancement
```javascript
// Added to existing AnnotationProject schema
deletionOTP: {
  code: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  requestedBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "DTUser",
    default: null 
  },
  requestedAt: { type: Date, default: null },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "DTUser",
    default: null 
  }
}
```

---

## Usage Examples

### Frontend Integration Example

```javascript
// Step 1: Attempt regular deletion
const deleteProject = async (projectId) => {
  try {
    const response = await fetch(`/api/admin/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Project deleted successfully');
    } else if (result.data?.requiresOTP) {
      // Project has active applications, need OTP
      showOTPRequiredDialog(projectId, result.data);
    } else {
      console.error('Deletion failed:', result.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

// Step 2: Request OTP for force deletion
const requestDeletionOTP = async (projectId, reason) => {
  try {
    const response = await fetch(`/api/admin/projects/${projectId}/request-deletion-otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('OTP sent to Projects Officer');
      showOTPInputDialog(projectId);
    } else {
      console.error('OTP request failed:', result.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

// Step 3: Verify OTP and delete
const verifyOTPAndDelete = async (projectId, otp, confirmationMessage) => {
  try {
    const response = await fetch(`/api/admin/projects/${projectId}/verify-deletion-otp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ otp, confirmationMessage })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Project deleted with OTP verification:', result.data);
      refreshProjectList();
    } else {
      console.error('OTP verification failed:', result.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

### cURL Examples

```bash
# Step 1: Request OTP
curl -X POST "http://localhost:8800/api/admin/projects/64f8a1b2c3d4e5f6a7b8c9d0/request-deletion-otp" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Project requirements changed"
  }'

# Step 2: Verify OTP and delete
curl -X POST "http://localhost:8800/api/admin/projects/64f8a1b2c3d4e5f6a7b8c9d0/verify-deletion-otp" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "otp": "123456",
    "confirmationMessage": "Confirmed deletion after Projects Officer approval"
  }'
```

---

## Security Features

### 1. OTP Security
- **6-digit random code**: Cryptographically secure random generation
- **15-minute expiry**: Prevents long-term misuse
- **One-time use**: OTP becomes invalid after successful verification
- **Secure delivery**: Sent only to verified Projects Officer email

### 2. Authorization Chain
- **Admin Authentication**: Requesting admin must be authenticated
- **Projects Officer Approval**: External approval from designated authority
- **Audit Logging**: All requests and actions are logged with timestamps

### 3. Data Protection
- **Confirmation Required**: Admin must explicitly confirm deletion understanding
- **Application Data Preserved**: Details of deleted applications are logged before removal
- **Email Notifications**: Both request and completion are communicated to Projects Officer

---

## Error Handling

### Common Error Scenarios

1. **Network Issues**: Graceful handling of email delivery failures
2. **Invalid OTP**: Clear messaging for incorrect codes
3. **Expired OTP**: Automatic cleanup and re-request option
4. **Already Processed**: Prevention of duplicate OTP usage
5. **Database Errors**: Transaction rollback on failures

### Error Recovery

1. **Failed OTP Delivery**: System logs error, admin can retry request
2. **Partial Deletion**: Transaction-based operations prevent incomplete deletions
3. **Email Service Down**: Graceful degradation with error logging

---

## Testing

### Manual Testing Steps

1. **Create test project with applications**
2. **Attempt regular deletion** → Should fail with OTP requirement
3. **Request deletion OTP** → Verify email delivery to projects@mydeeptech.ng
4. **Use invalid OTP** → Verify error handling
5. **Use valid OTP** → Verify successful deletion and confirmation email

### Test Environment Setup

```javascript
// Test configuration
const testConfig = {
  projectsOfficerEmail: 'projects@mydeeptech.ng',
  otpExpiryMinutes: 15,
  adminTestToken: 'your-test-admin-token',
  testProjectId: 'test-project-id-with-applications'
};
```

---

## Troubleshooting

### Common Issues

1. **OTP Not Received**: Check email service configuration and spam folders
2. **OTP Expired**: Request new OTP, verify system time synchronization
3. **Authentication Failed**: Verify admin token validity and permissions
4. **Email Service Error**: Check SMTP configuration and credentials

### Debug Information

- Server logs include detailed OTP generation and verification steps
- Email delivery status is logged for debugging
- Database queries are logged for troubleshooting

---

## Future Enhancements

### Potential Improvements

1. **SMS OTP Option**: Alternative delivery method for critical deletions
2. **Multi-Level Approval**: Additional approval layers for high-value projects
3. **Deletion Scheduling**: Schedule deletions during maintenance windows
4. **Bulk Operations**: OTP authorization for multiple project deletions
5. **Role-Based Permissions**: Different OTP requirements based on admin roles

### Integration Points

1. **Audit System**: Enhanced logging for compliance requirements
2. **Notification System**: Real-time alerts for stakeholders
3. **Backup System**: Automatic backup before deletion operations
4. **Reporting Dashboard**: Deletion analytics and trend analysis

---

This documentation provides comprehensive information about the OTP-based project deletion system, ensuring secure and authorized removal of projects with active applications while maintaining proper audit trails and stakeholder communication.