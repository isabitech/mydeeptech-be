# Invoicing and Payment System API Documentation

## Overview
Complete invoicing and payment tracking system where admins can raise invoices for DTUser project work, users receive email notifications, and both parties can track payment status.

## Base URL
```
http://localhost:5000/api
```

## Email Configuration
- **Payment Notifications**: payments@mydeeptech.ng
- **Sender Name**: MyDeepTech Payments (configurable via `BREVO_PAYMENTS_SENDER_NAME`)

---

## 💰 Admin Invoice Endpoints

### 1. Create Invoice
**POST** `/admin/invoices`

Create an invoice for a DTUser's completed project work.

#### Headers
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### Request Body
```json
{
  "projectId": "6910d1789410dbfa4798df47",
  "dtUserId": "69105d39c4a9bb94d5bcae10",
  "invoiceAmount": 250.00,
  "currency": "USD",
  "dueDate": "2025-12-01T23:59:59.000Z",
  "workPeriodStart": "2025-11-01T00:00:00.000Z",
  "workPeriodEnd": "2025-11-15T23:59:59.000Z",
  "description": "Payment for image annotation project completion",
  "workDescription": "Completed 500 high-quality image annotations with 98% accuracy rate",
  "hoursWorked": 20,
  "tasksCompleted": 500,
  "qualityScore": 98,
  "invoiceType": "project_completion",
  "adminNotes": "Excellent work quality, completed ahead of schedule"
}
```

#### Field Descriptions
- `projectId` (required): ID of the project the work was done on
- `dtUserId` (required): ID of the DTUser to invoice
- `invoiceAmount` (required): Invoice amount (minimum 0.01)
- `currency`: Currency code (USD, EUR, GBP, NGN, KES, GHS)
- `dueDate` (required): Payment due date
- `workPeriodStart/End`: Period when work was performed
- `description`: Brief invoice description (max 1000 chars)
- `workDescription`: Detailed work description (max 2000 chars)
- `hoursWorked`: Number of hours worked
- `tasksCompleted`: Number of tasks completed
- `qualityScore`: Work quality score (0-100)
- `invoiceType`: Type of invoice (project_completion, milestone, hourly, fixed_rate, bonus)
- `adminNotes`: Admin notes (max 1000 chars)

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Invoice created successfully",
  "data": {
    "invoice": {
      "_id": "invoice_id",
      "invoiceNumber": "202511090001",
      "formattedInvoiceNumber": "INV-202511090001",
      "project": {
        "_id": "project_id",
        "projectName": "Image Classification Project",
        "projectDescription": "..."
      },
      "dtUser": {
        "_id": "user_id",
        "fullName": "John Doe",
        "email": "john@example.com"
      },
      "createdBy": {
        "_id": "admin_id",
        "fullName": "Admin Name",
        "email": "admin@mydeeptech.ng"
      },
      "invoiceAmount": 250,
      "currency": "USD",
      "invoiceDate": "2025-11-09T17:30:00.000Z",
      "dueDate": "2025-12-01T23:59:59.000Z",
      "paymentStatus": "unpaid",
      "status": "sent",
      "description": "Payment for image annotation project completion",
      "workDescription": "Completed 500 high-quality image annotations...",
      "hoursWorked": 20,
      "tasksCompleted": 500,
      "qualityScore": 98,
      "invoiceType": "project_completion",
      "adminNotes": "Excellent work quality...",
      "emailSent": true,
      "createdAt": "2025-11-09T17:30:00.000Z"
    },
    "emailNotificationSent": true
  }
}
```

#### Email Notification
DTUser receives professional invoice notification with:
- Invoice details and amount
- Project information
- Due date
- Link to view invoice in dashboard

---

### 2. Get All Invoices
**GET** `/admin/invoices`

Retrieve all invoices with filtering and pagination.

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `paymentStatus` (optional): unpaid, paid, overdue, cancelled, disputed
- `projectId` (optional): Filter by specific project
- `dtUserId` (optional): Filter by specific DTUser
- `startDate` (optional): Filter invoices from date (ISO string)
- `endDate` (optional): Filter invoices to date (ISO string)
- `invoiceType` (optional): Filter by invoice type

#### Example Request
```
GET /admin/invoices?paymentStatus=unpaid&page=1&limit=10&startDate=2025-11-01
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "invoice_id",
        "invoiceNumber": "202511090001",
        "projectId": {
          "projectName": "Image Classification",
          "projectCategory": "Image Annotation"
        },
        "dtUserId": {
          "fullName": "John Doe",
          "email": "john@example.com",
          "phone": "+1234567890"
        },
        "createdBy": {
          "fullName": "Admin Name",
          "email": "admin@mydeeptech.ng"
        },
        "invoiceAmount": 250,
        "currency": "USD",
        "invoiceDate": "2025-11-09T17:30:00.000Z",
        "dueDate": "2025-12-01T23:59:59.000Z",
        "paymentStatus": "unpaid",
        "status": "sent",
        "description": "Payment for image annotation project completion",
        "hoursWorked": 20,
        "tasksCompleted": 500,
        "qualityScore": 98,
        "createdAt": "2025-11-09T17:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalInvoices": 25,
      "invoicesPerPage": 10
    },
    "summary": {
      "totalAmount": 5000,
      "paidAmount": 3500,
      "unpaidAmount": 1500,
      "totalInvoices": 25,
      "paidInvoices": 18,
      "unpaidInvoices": 6,
      "overdueInvoices": 1
    }
  }
}
```

---

### 3. Get Invoice Details
**GET** `/admin/invoices/:invoiceId`

Get detailed information about a specific invoice.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "invoice_id",
      "invoiceNumber": "202511090001",
      "projectId": {
        "projectName": "Image Classification Project",
        "projectDescription": "...",
        "projectCategory": "Image Annotation"
      },
      "dtUserId": {
        "fullName": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "skills": ["Image Annotation", "Computer Vision"]
      },
      "createdBy": {
        "fullName": "Admin Name",
        "email": "admin@mydeeptech.ng"
      },
      "invoiceAmount": 250,
      "currency": "USD",
      "paymentStatus": "unpaid",
      "paidAt": null,
      "paidAmount": null,
      "paymentMethod": null,
      "paymentReference": null,
      "paymentNotes": null,
      "workPeriodStart": "2025-11-01T00:00:00.000Z",
      "workPeriodEnd": "2025-11-15T23:59:59.000Z",
      "description": "Payment for image annotation project completion",
      "workDescription": "Completed 500 high-quality image annotations...",
      "hoursWorked": 20,
      "tasksCompleted": 500,
      "qualityScore": 98,
      "invoiceType": "project_completion",
      "adminNotes": "Excellent work quality...",
      "emailSent": true,
      "emailSentAt": "2025-11-09T17:30:00.000Z",
      "lastEmailReminder": null,
      "emailViewedAt": null
    },
    "computedFields": {
      "daysOverdue": 0,
      "amountDue": 250,
      "formattedInvoiceNumber": "INV-202511090001"
    }
  }
}
```

---

### 4. Update Payment Status
**PATCH** `/admin/invoices/:invoiceId/payment-status`

Update the payment status of an invoice.

#### Request Body
```json
{
  "paymentStatus": "paid",
  "paymentMethod": "bank_transfer",
  "paymentReference": "TXN123456789",
  "paymentNotes": "Paid via bank transfer on schedule",
  "paidAmount": 250.00
}
```

#### Payment Status Values
- `unpaid` - Invoice not yet paid
- `paid` - Invoice fully paid
- `overdue` - Payment past due date
- `cancelled` - Invoice cancelled
- `disputed` - Payment disputed

#### Payment Methods
- `bank_transfer`
- `paypal`
- `stripe`
- `cryptocurrency`
- `cash`
- `other`

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Invoice payment status updated to paid",
  "data": {
    "invoice": {
      "_id": "invoice_id",
      "paymentStatus": "paid",
      "paidAt": "2025-11-09T18:00:00.000Z",
      "paidAmount": 250,
      "paymentMethod": "bank_transfer",
      "paymentReference": "TXN123456789",
      "paymentNotes": "Paid via bank transfer on schedule"
    },
    "emailNotificationSent": true
  }
}
```

#### Email Notification
DTUser receives payment confirmation email with:
- Payment confirmation details
- Payment method and reference
- Updated invoice status
- Receipt information

---

### 5. Send Payment Reminder
**POST** `/admin/invoices/:invoiceId/send-reminder`

Send payment reminder email for unpaid invoice.

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment reminder sent successfully",
  "data": {
    "invoiceId": "invoice_id",
    "invoiceNumber": "202511090001",
    "sentTo": "john@example.com",
    "sentAt": "2025-11-09T18:30:00.000Z"
  }
}
```

#### Email Notification
DTUser receives payment reminder with:
- Overdue notice and days overdue
- Invoice details and amount due
- Payment instructions
- Contact information for support

---

### 6. Delete Invoice
**DELETE** `/admin/invoices/:invoiceId`

Delete an invoice (only unpaid invoices created within last 24 hours).

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Invoice deleted successfully"
}
```

---

## 👤 DTUser Invoice Endpoints

### 1. Get All User Invoices
**GET** `/auth/invoices`

Retrieve all invoices for the authenticated DTUser.

#### Headers
```
Authorization: Bearer <dtuser_token>
```

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `paymentStatus` (optional): unpaid, paid, overdue
- `projectId` (optional): Filter by specific project
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "invoice_id",
        "invoiceNumber": "202511090001",
        "projectId": {
          "projectName": "Image Classification Project",
          "projectCategory": "Image Annotation",
          "payRate": 25
        },
        "createdBy": {
          "fullName": "Admin Name",
          "email": "admin@mydeeptech.ng"
        },
        "invoiceAmount": 250,
        "currency": "USD",
        "invoiceDate": "2025-11-09T17:30:00.000Z",
        "dueDate": "2025-12-01T23:59:59.000Z",
        "paymentStatus": "paid",
        "paidAt": "2025-11-15T10:30:00.000Z",
        "paymentMethod": "bank_transfer",
        "description": "Payment for image annotation project completion"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalInvoices": 15,
      "invoicesPerPage": 10
    },
    "statistics": {
      "totalInvoices": 15,
      "totalEarnings": 3750,
      "paidAmount": 3250,
      "unpaidAmount": 500,
      "overdueAmount": 0,
      "unpaidCount": 2,
      "paidCount": 13,
      "overdueCount": 0
    }
  }
}
```

---

### 2. Get Unpaid Invoices
**GET** `/auth/invoices/unpaid`

Retrieve only unpaid and overdue invoices for the user.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "unpaidInvoices": [
      {
        "_id": "invoice_id",
        "invoiceNumber": "202511090002",
        "projectId": {
          "projectName": "Text Analysis Project",
          "projectCategory": "Text Annotation"
        },
        "createdBy": {
          "fullName": "Admin Name",
          "email": "admin@mydeeptech.ng"
        },
        "invoiceAmount": 150,
        "currency": "USD",
        "dueDate": "2025-11-25T23:59:59.000Z",
        "paymentStatus": "unpaid",
        "description": "Payment for text annotation tasks"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalUnpaidInvoices": 2,
      "invoicesPerPage": 10
    },
    "summary": {
      "totalAmountDue": 300,
      "overdueAmount": 0,
      "unpaidCount": 2
    }
  }
}
```

---

### 3. Get Paid Invoices
**GET** `/auth/invoices/paid`

Retrieve only paid invoices for the user.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "paidInvoices": [
      {
        "_id": "invoice_id",
        "invoiceNumber": "202511090001",
        "projectId": {
          "projectName": "Image Classification Project",
          "projectCategory": "Image Annotation"
        },
        "invoiceAmount": 250,
        "currency": "USD",
        "paidAt": "2025-11-15T10:30:00.000Z",
        "paymentMethod": "bank_transfer",
        "paymentReference": "TXN123456789"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalPaidInvoices": 13,
      "invoicesPerPage": 10
    },
    "summary": {
      "totalEarnings": 3250,
      "paidCount": 13
    }
  }
}
```

---

### 4. Get Invoice Dashboard
**GET** `/auth/invoices/dashboard`

Get comprehensive invoice dashboard with statistics and recent invoices.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalInvoices": 15,
      "totalAmount": 3750,
      "paidAmount": 3250,
      "unpaidAmount": 500,
      "overdueAmount": 0,
      "unpaidCount": 2,
      "paidCount": 13,
      "overdueCount": 0
    },
    "recentInvoices": [
      {
        "_id": "invoice_id",
        "invoiceNumber": "202511090002",
        "projectId": {
          "projectName": "Text Analysis Project"
        },
        "invoiceAmount": 150,
        "paymentStatus": "unpaid",
        "dueDate": "2025-11-25T23:59:59.000Z"
      }
    ],
    "overdueInvoices": [],
    "monthlyEarnings": [
      {
        "_id": { "year": 2025, "month": 11 },
        "totalEarnings": 500,
        "invoiceCount": 2
      },
      {
        "_id": { "year": 2025, "month": 10 },
        "totalEarnings": 750,
        "invoiceCount": 3
      }
    ],
    "summary": {
      "totalEarned": 3250,
      "pendingPayments": 500,
      "overduePayments": 0,
      "totalInvoices": 15,
      "unpaidCount": 2,
      "overdueCount": 0
    }
  }
}
```

---

### 5. Get Invoice Details
**GET** `/auth/invoices/:invoiceId`

Get detailed information about a specific invoice (user's own invoices only).

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "invoice_id",
      "invoiceNumber": "202511090001",
      "projectId": {
        "projectName": "Image Classification Project",
        "projectDescription": "...",
        "projectCategory": "Image Annotation"
      },
      "createdBy": {
        "fullName": "Admin Name",
        "email": "admin@mydeeptech.ng"
      },
      "invoiceAmount": 250,
      "currency": "USD",
      "invoiceDate": "2025-11-09T17:30:00.000Z",
      "dueDate": "2025-12-01T23:59:59.000Z",
      "paymentStatus": "paid",
      "paidAt": "2025-11-15T10:30:00.000Z",
      "paidAmount": 250,
      "paymentMethod": "bank_transfer",
      "paymentReference": "TXN123456789",
      "paymentNotes": "Paid via bank transfer on schedule",
      "workPeriodStart": "2025-11-01T00:00:00.000Z",
      "workPeriodEnd": "2025-11-15T23:59:59.000Z",
      "description": "Payment for image annotation project completion",
      "workDescription": "Completed 500 high-quality image annotations...",
      "hoursWorked": 20,
      "tasksCompleted": 500,
      "qualityScore": 98,
      "emailViewedAt": "2025-11-09T17:35:00.000Z"
    },
    "computedFields": {
      "daysOverdue": 0,
      "amountDue": 0,
      "formattedInvoiceNumber": "INV-202511090001"
    }
  }
}
```

---

## 📧 Email Notifications

### Invoice Created Notification
**From**: payments@mydeeptech.ng  
**Subject**: "New Invoice #[invoice_number] - $[amount] Due"

**Content**:
- Professional invoice details
- Project information
- Amount due and due date
- Link to view in dashboard
- Payment instructions

### Payment Confirmation
**From**: payments@mydeeptech.ng  
**Subject**: "Payment Received - Invoice #[invoice_number] ($[amount])"

**Content**:
- Payment confirmation details
- Payment method and reference
- Receipt information
- Thank you message

### Payment Reminder
**From**: payments@mydeeptech.ng  
**Subject**: "⚠️ Payment Reminder - Invoice #[invoice_number] ([days] days overdue)"

**Content**:
- Overdue notice
- Invoice details
- Payment instructions
- Contact information

---

## 🔢 Invoice Number Format

Invoices are automatically assigned sequential numbers in the format:
- **Format**: `YYYYMMNNNN`
- **Example**: `202511090001`
- **Display**: `INV-202511090001`

Where:
- `YYYY` = Year
- `MM` = Month (zero-padded)
- `NNNN` = Sequential number within the month

---

## 📊 Invoice Types

- **project_completion** - Payment for completed project
- **milestone** - Milestone-based payment
- **hourly** - Hourly rate payment
- **fixed_rate** - Fixed rate payment
- **bonus** - Bonus payment

---

## ⚠️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["invoiceAmount is required", "dueDate must be in the future"]
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Can only create invoices for approved annotators"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Invoice not found or access denied"
}
```

---

## 🔧 Environment Variables

Add to your `.env` file:
```bash
BREVO_PAYMENTS_SENDER_NAME=MyDeepTech Payments
```

---

## 🧪 Testing

Use the test file to verify the complete workflow:
```bash
# Start server
node index.js

# Run invoicing system test
node test-invoicing-system.js
```

The test covers:
- Invoice creation and email notifications
- Admin invoice management
- DTUser invoice viewing and dashboard
- Payment status updates and confirmations
- Payment reminders for overdue invoices

---

This invoicing system provides complete payment tracking from creation to payment with professional email notifications and comprehensive dashboard views for both admins and DTUsers.