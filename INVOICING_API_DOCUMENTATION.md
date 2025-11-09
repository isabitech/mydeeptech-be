# MyDeepTech Invoicing API Documentation

## Base URL
```
http://localhost:5000/api
```

---

## Authentication

All invoicing endpoints require authentication using Bearer tokens in the Authorization header:

```
Authorization: Bearer <token>
```

**Admin endpoints**: Use admin JWT token obtained from admin login
**DTUser endpoints**: Use DTUser JWT token obtained from DTUser login

---

## 📋 Table of Contents

### Admin Endpoints
1. [Create Invoice](#1-create-invoice)
2. [Get All Invoices](#2-get-all-invoices)
3. [Get Invoice Details](#3-get-invoice-details)
4. [Update Payment Status](#4-update-payment-status)
5. [Send Payment Reminder](#5-send-payment-reminder)
6. [Delete Invoice](#6-delete-invoice)

### DTUser Endpoints
7. [Get User Invoices](#7-get-user-invoices)
8. [Get Unpaid Invoices](#8-get-unpaid-invoices)
9. [Get Paid Invoices](#9-get-paid-invoices)
10. [Get Invoice Dashboard](#10-get-invoice-dashboard)
11. [Get Invoice Details (DTUser)](#11-get-invoice-details-dtuser)

---

## 🔧 Admin Endpoints

### 1. Create Invoice

**Endpoint**: `POST /admin/invoices`

**Description**: Create a new invoice for a DTUser who has worked on a project.

**Authentication**: Admin Bearer token required

**Request Body**:
```json
{
  "projectId": "64f7b8c9e12345678901234a",
  "dtUserId": "64f7b8c9e12345678901234b",
  "invoiceAmount": 2500,
  "currency": "USD",
  "dueDate": "2025-12-09T00:00:00.000Z",
  "workPeriodStart": "2025-10-01T00:00:00.000Z",
  "workPeriodEnd": "2025-10-31T00:00:00.000Z",
  "description": "Payment for text annotation work completed",
  "workDescription": "Annotated 500 text samples for sentiment analysis project",
  "hoursWorked": 40,
  "tasksCompleted": 100,
  "qualityScore": 95,
  "invoiceType": "project_completion",
  "adminNotes": "Excellent work quality, completed ahead of schedule"
}
```

**Required Fields**:
- `projectId` (string): Valid MongoDB ObjectId of existing project
- `dtUserId` (string): Valid MongoDB ObjectId of approved DTUser
- `invoiceAmount` (number): Amount > 0.01
- `dueDate` (date): Future date

**Optional Fields**:
- `currency` (string): "USD", "EUR", "GBP", "NGN", "KES", "GHS" (default: "USD")
- `invoiceDate` (date): Default: current date
- `workPeriodStart` (date): Start date of work period
- `workPeriodEnd` (date): End date of work period
- `description` (string): Invoice description (max 1000 chars)
- `workDescription` (string): Work details (max 2000 chars)
- `hoursWorked` (number): Hours worked (≥ 0)
- `tasksCompleted` (number): Number of tasks completed (≥ 0)
- `qualityScore` (number): Quality score 0-100
- `invoiceType` (string): "project_completion", "milestone", "hourly", "fixed_rate", "bonus" (default: "project_completion")
- `adminNotes` (string): Admin notes (max 1000 chars)

**Success Response**: `201 Created`
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "invoice": {
      "_id": "64f7b8c9e12345678901234c",
      "invoiceNumber": "2025110001",
      "formattedInvoiceNumber": "INV-2025110001",
      "project": {
        "_id": "64f7b8c9e12345678901234a",
        "projectName": "Sentiment Analysis Project",
        "projectDescription": "Analyze customer reviews for sentiment"
      },
      "dtUser": {
        "_id": "64f7b8c9e12345678901234b",
        "fullName": "John Doe",
        "email": "john.doe@example.com"
      },
      "createdBy": {
        "_id": "64f7b8c9e12345678901234d",
        "fullName": "Admin User",
        "email": "admin@mydeeptech.ng"
      },
      "invoiceAmount": 2500,
      "currency": "USD",
      "invoiceDate": "2025-11-09T19:27:03.870Z",
      "dueDate": "2025-12-09T00:00:00.000Z",
      "paymentStatus": "unpaid",
      "status": "sent",
      "description": "Payment for text annotation work completed",
      "workDescription": "Annotated 500 text samples for sentiment analysis project",
      "hoursWorked": 40,
      "tasksCompleted": 100,
      "qualityScore": 95,
      "invoiceType": "project_completion",
      "adminNotes": "Excellent work quality, completed ahead of schedule",
      "emailSent": true,
      "createdAt": "2025-11-09T19:27:03.870Z"
    },
    "emailNotificationSent": true
  }
}
```

**Error Responses**:
- `400 Bad Request`: Validation errors, invalid IDs, or user hasn't worked on project
- `404 Not Found`: Project or DTUser not found
- `500 Internal Server Error`: Server error

---

### 2. Get All Invoices

**Endpoint**: `GET /admin/invoices`

**Description**: Get all invoices with filtering, pagination, and summary statistics.

**Authentication**: Admin Bearer token required

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `paymentStatus` (string): Filter by payment status ("unpaid", "paid", "overdue", "cancelled", "disputed")
- `projectId` (string): Filter by project ID
- `dtUserId` (string): Filter by DTUser ID
- `startDate` (date): Filter invoices from this date
- `endDate` (date): Filter invoices until this date
- `invoiceType` (string): Filter by invoice type

**Example Request**:
```
GET /admin/invoices?page=1&limit=10&paymentStatus=unpaid&startDate=2025-01-01
```

**Success Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "64f7b8c9e12345678901234c",
        "invoiceNumber": "2025110001",
        "formattedInvoiceNumber": "INV-2025110001",
        "projectId": {
          "_id": "64f7b8c9e12345678901234a",
          "projectName": "Sentiment Analysis Project",
          "projectCategory": "Text Annotation"
        },
        "dtUserId": {
          "_id": "64f7b8c9e12345678901234b",
          "fullName": "John Doe",
          "email": "john.doe@example.com",
          "phone": "+1234567890"
        },
        "createdBy": {
          "_id": "64f7b8c9e12345678901234d",
          "fullName": "Admin User",
          "email": "admin@mydeeptech.ng"
        },
        "invoiceAmount": 2500,
        "currency": "USD",
        "invoiceDate": "2025-11-09T19:27:03.870Z",
        "dueDate": "2025-12-09T00:00:00.000Z",
        "paymentStatus": "unpaid",
        "status": "sent",
        "description": "Payment for text annotation work completed",
        "emailSent": true,
        "createdAt": "2025-11-09T19:27:03.870Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalInvoices": 47,
      "invoicesPerPage": 10
    },
    "summary": {
      "totalAmount": 125000,
      "paidAmount": 75000,
      "unpaidAmount": 50000,
      "totalInvoices": 47,
      "paidInvoices": 30,
      "unpaidInvoices": 15,
      "overdueInvoices": 2
    }
  }
}
```

---

### 3. Get Invoice Details

**Endpoint**: `GET /admin/invoices/:invoiceId`

**Description**: Get detailed information about a specific invoice.

**Authentication**: Admin Bearer token required

**URL Parameters**:
- `invoiceId` (string): Invoice ID

**Success Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "64f7b8c9e12345678901234c",
      "invoiceNumber": "2025110001",
      "formattedInvoiceNumber": "INV-2025110001",
      "projectId": {
        "_id": "64f7b8c9e12345678901234a",
        "projectName": "Sentiment Analysis Project",
        "projectDescription": "Analyze customer reviews for sentiment",
        "projectCategory": "Text Annotation"
      },
      "dtUserId": {
        "_id": "64f7b8c9e12345678901234b",
        "fullName": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1234567890",
        "skills": ["NLP", "Text Annotation"]
      },
      "createdBy": {
        "_id": "64f7b8c9e12345678901234d",
        "fullName": "Admin User",
        "email": "admin@mydeeptech.ng"
      },
      "invoiceAmount": 2500,
      "currency": "USD",
      "invoiceDate": "2025-11-09T19:27:03.870Z",
      "dueDate": "2025-12-09T00:00:00.000Z",
      "paymentStatus": "unpaid",
      "status": "sent",
      "description": "Payment for text annotation work completed",
      "workDescription": "Annotated 500 text samples for sentiment analysis project",
      "hoursWorked": 40,
      "tasksCompleted": 100,
      "qualityScore": 95,
      "invoiceType": "project_completion",
      "adminNotes": "Excellent work quality, completed ahead of schedule",
      "emailSent": true,
      "emailSentAt": "2025-11-09T19:27:05.000Z",
      "createdAt": "2025-11-09T19:27:03.870Z",
      "updatedAt": "2025-11-09T19:27:05.000Z"
    },
    "computedFields": {
      "daysOverdue": 0,
      "amountDue": 2500,
      "formattedInvoiceNumber": "INV-2025110001"
    }
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid invoice ID
- `404 Not Found`: Invoice not found
- `500 Internal Server Error`: Server error

---

### 4. Update Payment Status

**Endpoint**: `PATCH /admin/invoices/:invoiceId/payment-status`

**Description**: Update the payment status of an invoice.

**Authentication**: Admin Bearer token required

**URL Parameters**:
- `invoiceId` (string): Invoice ID

**Request Body**:
```json
{
  "paymentStatus": "paid",
  "paymentMethod": "bank_transfer",
  "paymentReference": "TXN123456789",
  "paymentNotes": "Payment received via bank transfer",
  "paidAmount": 2500
}
```

**Required Fields**:
- `paymentStatus` (string): "unpaid", "paid", "overdue", "cancelled", "disputed"

**Optional Fields** (required when status = "paid"):
- `paymentMethod` (string): "bank_transfer", "paypal", "stripe", "cryptocurrency", "cash", "other"
- `paymentReference` (string): Payment reference/transaction ID
- `paymentNotes` (string): Additional payment notes
- `paidAmount` (number): Amount paid (defaults to invoice amount)

**Success Response**: `200 OK`
```json
{
  "success": true,
  "message": "Invoice payment status updated to paid",
  "data": {
    "invoice": {
      "_id": "64f7b8c9e12345678901234c",
      "invoiceNumber": "2025110001",
      "paymentStatus": "paid",
      "status": "paid",
      "paidAt": "2025-11-09T20:15:30.123Z",
      "paidAmount": 2500,
      "paymentMethod": "bank_transfer",
      "paymentReference": "TXN123456789",
      "paymentNotes": "Payment received via bank transfer",
      "dtUserId": {
        "_id": "64f7b8c9e12345678901234b",
        "fullName": "John Doe",
        "email": "john.doe@example.com"
      },
      "projectId": {
        "_id": "64f7b8c9e12345678901234a",
        "projectName": "Sentiment Analysis Project"
      }
    },
    "emailNotificationSent": true
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid payment status
- `404 Not Found`: Invoice not found
- `500 Internal Server Error`: Server error

---

### 5. Send Payment Reminder

**Endpoint**: `POST /admin/invoices/:invoiceId/send-reminder`

**Description**: Send a payment reminder email to the DTUser for an unpaid invoice.

**Authentication**: Admin Bearer token required

**URL Parameters**:
- `invoiceId` (string): Invoice ID

**Request Body**: Empty `{}`

**Success Response**: `200 OK`
```json
{
  "success": true,
  "message": "Payment reminder sent successfully",
  "data": {
    "invoiceId": "64f7b8c9e12345678901234c",
    "invoiceNumber": "2025110001",
    "sentTo": "john.doe@example.com",
    "sentAt": "2025-11-09T20:20:15.456Z"
  }
}
```

**Error Responses**:
- `400 Bad Request`: Cannot send reminder for paid invoice
- `404 Not Found`: Invoice not found
- `500 Internal Server Error`: Failed to send email or server error

---

### 6. Delete Invoice

**Endpoint**: `DELETE /admin/invoices/:invoiceId`

**Description**: Delete an invoice (only unpaid invoices created within last 24 hours).

**Authentication**: Admin Bearer token required

**URL Parameters**:
- `invoiceId` (string): Invoice ID

**Request Body**: Empty

**Success Response**: `200 OK`
```json
{
  "success": true,
  "message": "Invoice deleted successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Can only delete unpaid invoices created within last 24 hours
- `404 Not Found`: Invoice not found
- `500 Internal Server Error`: Server error

---

## 👤 DTUser Endpoints

### 7. Get User Invoices

**Endpoint**: `GET /auth/invoices`

**Description**: Get all invoices for the authenticated DTUser with filtering and pagination.

**Authentication**: DTUser Bearer token required

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `paymentStatus` (string): Filter by payment status
- `startDate` (date): Filter from date
- `endDate` (date): Filter until date

**Success Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "64f7b8c9e12345678901234c",
        "invoiceNumber": "2025110001",
        "formattedInvoiceNumber": "INV-2025110001",
        "projectName": "Sentiment Analysis Project",
        "invoiceAmount": 2500,
        "currency": "USD",
        "invoiceDate": "2025-11-09T19:27:03.870Z",
        "dueDate": "2025-12-09T00:00:00.000Z",
        "paymentStatus": "unpaid",
        "status": "sent",
        "description": "Payment for text annotation work completed",
        "daysUntilDue": 30,
        "amountDue": 2500
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalInvoices": 15,
      "invoicesPerPage": 20
    },
    "summary": {
      "totalInvoices": 15,
      "totalAmount": 37500,
      "paidAmount": 25000,
      "unpaidAmount": 12500,
      "overdueAmount": 0,
      "paidCount": 10,
      "unpaidCount": 5,
      "overdueCount": 0
    }
  }
}
```

---

### 8. Get Unpaid Invoices

**Endpoint**: `GET /auth/invoices/unpaid`

**Description**: Get all unpaid invoices for the authenticated DTUser.

**Authentication**: DTUser Bearer token required

**Query Parameters**: Same as Get User Invoices

**Success Response**: `200 OK` (Same structure as Get User Invoices, but filtered to unpaid only)

---

### 9. Get Paid Invoices

**Endpoint**: `GET /auth/invoices/paid`

**Description**: Get all paid invoices for the authenticated DTUser.

**Authentication**: DTUser Bearer token required

**Query Parameters**: Same as Get User Invoices

**Success Response**: `200 OK` (Same structure as Get User Invoices, but filtered to paid only)

---

### 10. Get Invoice Dashboard

**Endpoint**: `GET /auth/invoices/dashboard`

**Description**: Get dashboard summary of invoices for the authenticated DTUser.

**Authentication**: DTUser Bearer token required

**Success Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalInvoices": 15,
      "totalAmount": 37500,
      "paidAmount": 25000,
      "unpaidAmount": 12500,
      "overdueAmount": 0,
      "paidCount": 10,
      "unpaidCount": 5,
      "overdueCount": 0,
      "averageInvoiceAmount": 2500,
      "lastPaymentDate": "2025-11-01T10:30:00.000Z",
      "nextDueDate": "2025-12-09T00:00:00.000Z"
    },
    "recentInvoices": [
      {
        "_id": "64f7b8c9e12345678901234c",
        "invoiceNumber": "2025110001",
        "formattedInvoiceNumber": "INV-2025110001",
        "projectName": "Sentiment Analysis Project",
        "invoiceAmount": 2500,
        "currency": "USD",
        "dueDate": "2025-12-09T00:00:00.000Z",
        "paymentStatus": "unpaid",
        "daysUntilDue": 30
      }
    ],
    "upcomingPayments": [
      {
        "_id": "64f7b8c9e12345678901234c",
        "invoiceNumber": "2025110001",
        "projectName": "Sentiment Analysis Project",
        "dueDate": "2025-12-09T00:00:00.000Z",
        "amount": 2500,
        "currency": "USD",
        "daysUntilDue": 30
      }
    ]
  }
}
```

---

### 11. Get Invoice Details (DTUser)

**Endpoint**: `GET /auth/invoices/:invoiceId`

**Description**: Get detailed information about a specific invoice (DTUser can only view their own invoices).

**Authentication**: DTUser Bearer token required

**URL Parameters**:
- `invoiceId` (string): Invoice ID

**Success Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "64f7b8c9e12345678901234c",
      "invoiceNumber": "2025110001",
      "formattedInvoiceNumber": "INV-2025110001",
      "projectName": "Sentiment Analysis Project",
      "projectDescription": "Analyze customer reviews for sentiment",
      "invoiceAmount": 2500,
      "currency": "USD",
      "invoiceDate": "2025-11-09T19:27:03.870Z",
      "dueDate": "2025-12-09T00:00:00.000Z",
      "paymentStatus": "unpaid",
      "status": "sent",
      "description": "Payment for text annotation work completed",
      "workDescription": "Annotated 500 text samples for sentiment analysis project",
      "hoursWorked": 40,
      "tasksCompleted": 100,
      "qualityScore": 95,
      "invoiceType": "project_completion",
      "createdAt": "2025-11-09T19:27:03.870Z",
      "daysUntilDue": 30,
      "amountDue": 2500
    }
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid invoice ID
- `403 Forbidden`: Cannot access other user's invoices
- `404 Not Found`: Invoice not found
- `500 Internal Server Error`: Server error

---

## 📊 Data Models

### Invoice Status Values

**Payment Status**:
- `"unpaid"` - Invoice has not been paid
- `"paid"` - Invoice has been fully paid
- `"overdue"` - Invoice is past due date and unpaid
- `"cancelled"` - Invoice has been cancelled
- `"disputed"` - Invoice payment is disputed

**Invoice Status**:
- `"draft"` - Invoice is in draft state
- `"sent"` - Invoice has been sent to DTUser
- `"viewed"` - Invoice has been viewed by DTUser
- `"paid"` - Invoice has been paid
- `"overdue"` - Invoice is overdue
- `"cancelled"` - Invoice has been cancelled

**Currency Values**:
- `"USD"`, `"EUR"`, `"GBP"`, `"NGN"`, `"KES"`, `"GHS"`

**Payment Methods**:
- `"bank_transfer"`, `"paypal"`, `"stripe"`, `"cryptocurrency"`, `"cash"`, `"other"`

**Invoice Types**:
- `"project_completion"`, `"milestone"`, `"hourly"`, `"fixed_rate"`, `"bonus"`

### Invoice Number Format

Auto-generated invoice numbers follow the pattern: `YYYYMM####`
- `YYYY` - Year (e.g., 2025)
- `MM` - Month (e.g., 11 for November)
- `####` - 4-digit sequence number (0001, 0002, etc.)

Example: `2025110001` = First invoice of November 2025

---

## ⚠️ Error Handling

### Common Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## 🔐 Authentication Examples

### Admin Login
```javascript
const adminLogin = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@mydeeptech.ng',
    password: 'your-password'
  })
});
const { token } = await adminLogin.json();
```

### DTUser Login
```javascript
const dtUserLogin = await fetch('/api/auth/dtUserLogin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'user-password'
  })
});
const { token } = await dtUserLogin.json();
```

### Using Tokens in Requests
```javascript
const response = await fetch('/api/admin/invoices', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 📧 Email Notifications

The system automatically sends email notifications for:

1. **Invoice Created** - Sent to DTUser when new invoice is created
2. **Payment Confirmation** - Sent to DTUser when payment is marked as paid
3. **Payment Reminder** - Manually sent by admin for overdue invoices

All emails use the Brevo email service and are sent asynchronously to avoid blocking API responses.

---

## 💡 Best Practices

1. **Pagination**: Always use pagination for list endpoints to avoid large data transfers
2. **Error Handling**: Implement proper error handling for all API calls
3. **Token Management**: Store and refresh tokens securely
4. **Date Handling**: Use ISO 8601 format for all dates
5. **Validation**: Validate input data before sending API requests
6. **Loading States**: Show loading indicators during API calls
7. **Caching**: Consider caching invoice data that doesn't change frequently

---

## 🛠️ Testing

You can test the API using the provided test file:

```bash
node test-invoicing-simple.js
```

This will run a comprehensive test of the invoicing system including:
- Admin authentication
- DTUser selection
- Project creation
- Invoice creation
- Payment status updates

---

Last Updated: November 9, 2025