# 📚 Admin API Documentation

## Base URL
```
/api/admin
```

All admin endpoints require authentication using a JWT token obtained from the admin login endpoint.

---

## 🔐 Authentication Endpoints

### 1. Admin Login
**Endpoint:** `POST /api/admin/login`  
**Description:** Authenticate admin user and get JWT token  
**Authentication:** None required

#### Request Body:
```json
{
  "email": "admin@mydeeptech.ng",
  "password": "admin_password"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Admin login successful",
  "admin": {
    "id": "admin_id",
    "fullName": "Admin Name",
    "email": "admin@mydeeptech.ng",
    "role": "admin"
  },
  "token": "jwt_token_here"
}
```

### 2. Admin Registration
**Endpoint:** `POST /api/admin/register`  
**Description:** Create a new admin account  
**Authentication:** None required

#### Request Body:
```json
{
  "fullName": "Admin Name",
  "email": "admin@mydeeptech.ng",
  "phone": "+1234567890",
  "password": "secure_password",
  "domains": ["Administration"],
  "role": "admin"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Admin created successfully",
  "admin": {
    "id": "admin_id",
    "fullName": "Admin Name",
    "email": "admin@mydeeptech.ng"
  }
}
```

---

## 📊 Dashboard Endpoints

### 3. Admin Dashboard Overview
**Endpoint:** `GET /api/admin/dashboard`  
**Description:** Get comprehensive platform statistics and overview  
**Authentication:** Admin JWT token required

#### Headers:
```
Authorization: Bearer <admin_jwt_token>
```

#### Response:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 150,
      "totalProjects": 25,
      "totalInvoices": 75,
      "totalRevenue": 12500.50,
      "pendingApplications": 8
    },
    "dtUserStatistics": {
      "totalUsers": 150,
      "pendingAnnotators": 25,
      "submittedAnnotators": 30,
      "verifiedAnnotators": 20,
      "approvedAnnotators": 65,
      "rejectedAnnotators": 10,
      "pendingMicroTaskers": 15,
      "approvedMicroTaskers": 40,
      "verifiedEmails": 120,
      "usersWithPasswords": 140,
      "usersWithResults": 85
    },
    "projectStatistics": {
      "totalProjects": 25,
      "activeProjects": 15,
      "completedProjects": 8,
      "pausedProjects": 2,
      "totalBudget": 50000,
      "totalSpent": 35000
    },
    "applicationStatistics": {
      "totalApplications": 200,
      "pendingApplications": 8,
      "approvedApplications": 150,
      "rejectedApplications": 42
    },
    "invoiceStatistics": {
      "totalInvoices": 75,
      "totalAmount": 15000,
      "paidAmount": 12500,
      "unpaidAmount": 2000,
      "overdueAmount": 500,
      "paidCount": 65,
      "unpaidCount": 8,
      "overdueCount": 2
    },
    "trends": {
      "recentRegistrations": [
        {
          "_id": { "year": 2025, "month": 11, "day": 10 },
          "count": 5
        }
      ],
      "recentInvoiceActivity": [
        {
          "_id": { "year": 2025, "month": 11, "day": 10 },
          "invoicesCreated": 3,
          "invoicesPaid": 2,
          "amountPaid": 750.00
        }
      ]
    },
    "topPerformers": {
      "topAnnotators": [
        {
          "fullName": "John Doe",
          "email": "john@example.com",
          "submissionCount": 15,
          "lastSubmission": "2025-11-10T10:00:00.000Z"
        }
      ]
    },
    "recentActivities": {
      "recentUsers": [
        {
          "fullName": "Jane Smith",
          "email": "jane@example.com",
          "annotatorStatus": "approved",
          "microTaskerStatus": "pending",
          "createdAt": "2025-11-10T08:00:00.000Z",
          "isEmailVerified": true
        }
      ],
      "recentProjects": [
        {
          "projectName": "Image Annotation Project",
          "status": "active",
          "budget": 5000,
          "spentBudget": 2500,
          "createdAt": "2025-11-09T15:00:00.000Z"
        }
      ]
    },
    "insights": {
      "domainDistribution": [
        { "_id": "Computer Vision", "count": 45 },
        { "_id": "Natural Language Processing", "count": 35 }
      ],
      "conversionRates": {
        "emailVerificationRate": "80.0",
        "passwordSetupRate": "93.3", 
        "resultSubmissionRate": "56.7",
        "approvalRate": "65.0"
      },
      "financialHealth": {
        "paymentRate": "86.7",
        "averageInvoiceAmount": "200.00",
        "outstandingBalance": 2500
      }
    },
    "generatedAt": "2025-11-11T12:00:00.000Z",
    "timeframe": {
      "registrationData": "30 days",
      "invoiceActivity": "7 days"
    }
  }
}
```

---

## 👥 User Management Endpoints

### 4. Get All DTUsers
**Endpoint:** `GET /api/admin/dtusers`  
**Description:** Get paginated list of all DTUsers with filtering and search  
**Authentication:** Admin JWT token required

#### Query Parameters:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search in name, email, phone
- `annotatorStatus` (optional): Filter by annotator status
- `microTaskerStatus` (optional): Filter by micro-tasker status
- `sortBy` (optional): Sort field (default: createdAt)
- `sortOrder` (optional): asc | desc (default: desc)

#### Example Request:
```
GET /api/admin/dtusers?page=1&limit=10&search=john&annotatorStatus=approved&sortBy=createdAt&sortOrder=desc
```

#### Response:
```json
{
  "success": true,
  "data": {
    "dtUsers": [
      {
        "_id": "user_id",
        "fullName": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "domains": ["Computer Vision"],
        "annotatorStatus": "approved",
        "microTaskerStatus": "pending",
        "isEmailVerified": true,
        "hasSetPassword": true,
        "resultLink": "cloudinary_url",
        "createdAt": "2025-11-10T10:00:00.000Z",
        "updatedAt": "2025-11-10T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 15,
      "totalUsers": 150,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "summary": {
      "totalUsers": 150,
      "statusSummary": {
        "pending": 25,
        "submitted": 30,
        "verified": 20,
        "approved": 65,
        "rejected": 10
      }
    }
  }
}
```

### 5. Get Single DTUser Details
**Endpoint:** `GET /api/admin/dtusers/:userId`  
**Description:** Get detailed information about a specific DTUser  
**Authentication:** Admin JWT token required

#### Response:
```json
{
  "success": true,
  "dtUser": {
    "_id": "user_id",
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "domains": ["Computer Vision"],
    "annotatorStatus": "approved",
    "microTaskerStatus": "pending",
    "resultLink": "cloudinary_url",
    "resultSubmissions": [
      {
        "cloudinaryResultData": {
          "url": "cloudinary_url",
          "originalName": "result.pdf"
        },
        "submissionDate": "2025-11-10T10:00:00.000Z",
        "status": "stored"
      }
    ],
    "personal_info": {
      "country": "Nigeria",
      "time_zone": "WAT",
      "available_hours_per_week": 40
    },
    "professional_background": {
      "education_field": "Computer Science",
      "years_of_experience": 3
    },
    "profilePicture": {
      "url": "profile_image_url"
    },
    "createdAt": "2025-11-10T10:00:00.000Z"
  }
}
```

### 6. Approve Annotator
**Endpoint:** `PATCH /api/admin/dtusers/:userId/approve`  
**Description:** Approve a DTUser as an annotator  
**Authentication:** Admin JWT token required

#### Request Body:
```json
{
  "newStatus": "approved"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Annotator approved successfully",
  "user": {
    "_id": "user_id",
    "fullName": "John Doe",
    "email": "john@example.com",
    "annotatorStatus": "approved",
    "updatedAt": "2025-11-11T12:00:00.000Z"
  }
}
```

### 7. Reject Annotator
**Endpoint:** `PATCH /api/admin/dtusers/:userId/reject`  
**Description:** Reject a DTUser's annotator application  
**Authentication:** Admin JWT token required

#### Request Body:
```json
{
  "rejectionReason": "Insufficient experience"
}
```

#### Response:
```json
{
  "success": true,
  "message": "Annotator rejected successfully",
  "user": {
    "_id": "user_id",
    "fullName": "John Doe", 
    "email": "john@example.com",
    "annotatorStatus": "rejected",
    "rejectionReason": "Insufficient experience"
  }
}
```

### 8. Get All Admin Users
**Endpoint:** `GET /api/admin/admin-users`  
**Description:** Get list of all admin users  
**Authentication:** Admin JWT token required

#### Query Parameters:
- `page`, `limit`, `search`, `sortBy`, `sortOrder` (same as DTUsers endpoint)

#### Response:
```json
{
  "success": true,
  "data": {
    "adminUsers": [
      {
        "_id": "admin_id",
        "fullName": "Admin User",
        "email": "admin@mydeeptech.ng",
        "phone": "+1234567890",
        "domains": ["Administration"],
        "role": "admin",
        "createdAt": "2025-11-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalAdminUsers": 5
    }
  }
}
```

---

## 📋 Project Management Endpoints

### 9. Create Annotation Project
**Endpoint:** `POST /api/admin/projects`  
**Description:** Create a new annotation project  
**Authentication:** Admin JWT token required

#### Request Body:
```json
{
  "projectName": "Image Classification Project",
  "description": "Classify images into categories",
  "projectType": "image_annotation",
  "budget": 5000,
  "timeline": {
    "startDate": "2025-11-15T00:00:00.000Z",
    "endDate": "2025-12-15T00:00:00.000Z"
  },
  "requirements": {
    "minExperience": 1,
    "requiredSkills": ["image_annotation", "classification"],
    "maxAnnotators": 10
  }
}
```

### 10. Get All Projects
**Endpoint:** `GET /api/admin/projects`  
**Description:** Get list of all annotation projects  
**Authentication:** Admin JWT token required

### 11. Get Project Details
**Endpoint:** `GET /api/admin/projects/:projectId`  
**Description:** Get detailed information about a specific project  
**Authentication:** Admin JWT token required

### 12. Update Project
**Endpoint:** `PATCH /api/admin/projects/:projectId`  
**Description:** Update project information  
**Authentication:** Admin JWT token required

### 13. Delete Project
**Endpoint:** `DELETE /api/admin/projects/:projectId`  
**Description:** Delete a project  
**Authentication:** Admin JWT token required

---

## 📄 Application Management Endpoints

### 14. Get Project Applications
**Endpoint:** `GET /api/admin/applications`  
**Description:** Get all project applications from DTUsers  
**Authentication:** Admin JWT token required

### 15. Approve Project Application
**Endpoint:** `PATCH /api/admin/applications/:applicationId/approve`  
**Description:** Approve a DTUser's project application  
**Authentication:** Admin JWT token required

### 16. Reject Project Application
**Endpoint:** `PATCH /api/admin/applications/:applicationId/reject`  
**Description:** Reject a DTUser's project application  
**Authentication:** Admin JWT token required

---

## 💰 Invoice Management Endpoints

### 17. Create Invoice
**Endpoint:** `POST /api/admin/invoices`  
**Description:** Create a new invoice for a DTUser  
**Authentication:** Admin JWT token required

#### Request Body:
```json
{
  "dtUserId": "user_id",
  "projectId": "project_id",
  "invoiceAmount": 500.00,
  "currency": "USD",
  "dueDate": "2025-11-25T00:00:00.000Z",
  "description": "Payment for annotation work",
  "hoursWorked": 20,
  "tasksCompleted": 50
}
```

### 18. Get All Invoices
**Endpoint:** `GET /api/admin/invoices`  
**Description:** Get list of all invoices with filtering  
**Authentication:** Admin JWT token required

#### Query Parameters:
- `page`, `limit` (pagination)
- `paymentStatus` (filter): unpaid | paid | overdue | cancelled | disputed
- `dtUserId` (filter): specific user
- `projectId` (filter): specific project

### 19. Get Invoice Details  
**Endpoint:** `GET /api/admin/invoices/:invoiceId`  
**Description:** Get detailed information about a specific invoice  
**Authentication:** Admin JWT token required

### 20. Update Payment Status
**Endpoint:** `PATCH /api/admin/invoices/:invoiceId/payment-status`  
**Description:** Update invoice payment status  
**Authentication:** Admin JWT token required

#### Request Body:
```json
{
  "paymentStatus": "paid",
  "paymentMethod": "bank_transfer",
  "paymentReference": "TXN123456789",
  "paymentNotes": "Paid via bank transfer"
}
```

### 21. Send Invoice Reminder
**Endpoint:** `POST /api/admin/invoices/:invoiceId/send-reminder`  
**Description:** Send payment reminder email to DTUser  
**Authentication:** Admin JWT token required

### 22. Delete Invoice
**Endpoint:** `DELETE /api/admin/invoices/:invoiceId`  
**Description:** Delete an invoice  
**Authentication:** Admin JWT token required

---

## ⚠️ Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Common HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## 🔒 Authentication Details

### Getting Admin Token:
1. Login using `POST /api/admin/login`
2. Use the returned `token` in the `Authorization` header
3. Format: `Authorization: Bearer <your_jwt_token>`

### Token Structure:
```javascript
{
  "userId": "admin_id",
  "email": "admin@mydeeptech.ng", 
  "role": "admin",
  "iat": 1699704000,
  "exp": 1699790400
}
```

### Token Expiry:
- Tokens expire after 24 hours
- Refresh by logging in again

---

## 📊 Rate Limiting

- **Dashboard endpoint**: 10 requests per minute
- **Other endpoints**: 100 requests per minute
- **Bulk operations**: 5 requests per minute

---

## 🧪 Testing

Use the provided test files:
- `test-admin-dashboard.html` - Interactive dashboard testing
- Admin login first to get JWT token
- Copy token to dashboard test interface

### Example cURL Commands:

```bash
# Login as admin
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mydeeptech.ng","password":"password"}'

# Get dashboard data
curl -X GET http://localhost:5000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get DTUsers
curl -X GET "http://localhost:5000/api/admin/dtusers?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Approve annotator
curl -X PATCH http://localhost:5000/api/admin/dtusers/USER_ID/approve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"approved"}'
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- All monetary amounts are in the specified currency
- Pagination starts from page 1
- Search is case-insensitive
- Admin accounts must have `@mydeeptech.ng` email domain or `Administration`/`Management` domains
- Dashboard data is computed in real-time from the database
- File uploads use Cloudinary integration

---

*Last updated: November 11, 2025*