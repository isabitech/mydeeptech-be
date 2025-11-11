# 📊 Admin Dashboard API Documentation

## Overview
The Admin Dashboard provides a comprehensive overview of platform statistics, user metrics, project data, and financial insights in a single endpoint.

---

## Endpoint Details

### **GET /api/admin/dashboard**
**Description:** Get comprehensive platform statistics and overview  
**Authentication:** Admin JWT token required  
**Method:** GET  

---

## Authentication

### Headers Required:
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

### Getting Admin Token:
1. Login using `POST /api/admin/login` with admin credentials
2. Use the returned `token` in the Authorization header
3. Token expires after 24 hours

---

## Request

### URL:
```
GET /api/admin/dashboard
```

### No request body or query parameters required

### Example Request:
```javascript
fetch('/api/admin/dashboard', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }
})
```

### cURL Example:
```bash
curl -X GET http://localhost:5000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Response

### Success Response (200 OK):
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
        },
        {
          "_id": { "year": 2025, "month": 11, "day": 11 },
          "count": 8
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
        },
        {
          "fullName": "Jane Smith",
          "email": "jane@example.com",
          "submissionCount": 12,
          "lastSubmission": "2025-11-09T14:30:00.000Z"
        }
      ]
    },
    "recentActivities": {
      "recentUsers": [
        {
          "fullName": "Alice Johnson",
          "email": "alice@example.com",
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
        { "_id": "Natural Language Processing", "count": 35 },
        { "_id": "Data Science", "count": 28 },
        { "_id": "Machine Learning", "count": 25 }
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

## Data Fields Explanation

### **Overview Section**
| Field | Type | Description |
|-------|------|-------------|
| `totalUsers` | Number | Total number of DTUsers (excluding admins) |
| `totalProjects` | Number | Total annotation projects created |
| `totalInvoices` | Number | Total invoices generated |
| `totalRevenue` | Number | Total amount from paid invoices |
| `pendingApplications` | Number | Project applications awaiting approval |

### **DTUser Statistics**
| Field | Type | Description |
|-------|------|-------------|
| `totalUsers` | Number | Total DTUsers count |
| `pendingAnnotators` | Number | Users with annotator status "pending" |
| `submittedAnnotators` | Number | Users with annotator status "submitted" |
| `verifiedAnnotators` | Number | Users with annotator status "verified" |
| `approvedAnnotators` | Number | Users with annotator status "approved" |
| `rejectedAnnotators` | Number | Users with annotator status "rejected" |
| `pendingMicroTaskers` | Number | Users with microTasker status "pending" |
| `approvedMicroTaskers` | Number | Users with microTasker status "approved" |
| `verifiedEmails` | Number | Users who have verified their email |
| `usersWithPasswords` | Number | Users who have set passwords |
| `usersWithResults` | Number | Users who have submitted results |

### **Project Statistics**
| Field | Type | Description |
|-------|------|-------------|
| `totalProjects` | Number | Total projects created |
| `activeProjects` | Number | Currently active projects |
| `completedProjects` | Number | Completed projects |
| `pausedProjects` | Number | Paused projects |
| `totalBudget` | Number | Sum of all project budgets |
| `totalSpent` | Number | Total amount spent across projects |

### **Application Statistics**
| Field | Type | Description |
|-------|------|-------------|
| `totalApplications` | Number | Total project applications |
| `pendingApplications` | Number | Applications awaiting review |
| `approvedApplications` | Number | Approved applications |
| `rejectedApplications` | Number | Rejected applications |

### **Invoice Statistics**
| Field | Type | Description |
|-------|------|-------------|
| `totalInvoices` | Number | Total invoices created |
| `totalAmount` | Number | Sum of all invoice amounts |
| `paidAmount` | Number | Total amount from paid invoices |
| `unpaidAmount` | Number | Total amount from unpaid invoices |
| `overdueAmount` | Number | Total amount from overdue invoices |
| `paidCount` | Number | Number of paid invoices |
| `unpaidCount` | Number | Number of unpaid invoices |
| `overdueCount` | Number | Number of overdue invoices |

### **Trends Section**
| Field | Type | Description |
|-------|------|-------------|
| `recentRegistrations` | Array | Daily user registration counts (30 days) |
| `recentInvoiceActivity` | Array | Daily invoice creation/payment activity (7 days) |

### **Top Performers**
| Field | Type | Description |
|-------|------|-------------|
| `topAnnotators` | Array | Top 10 annotators by submission count |

### **Recent Activities**
| Field | Type | Description |
|-------|------|-------------|
| `recentUsers` | Array | 10 most recent user registrations |
| `recentProjects` | Array | 5 most recent projects created |

### **Insights Section**
| Field | Type | Description |
|-------|------|-------------|
| `domainDistribution` | Array | User count by domain/expertise |
| `conversionRates` | Object | Platform conversion percentages |
| `financialHealth` | Object | Financial performance metrics |

---

## Error Responses

### 401 Unauthorized:
```json
{
  "success": false,
  "message": "Access denied. Admin authentication required."
}
```

### 403 Forbidden:
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

### 500 Internal Server Error:
```json
{
  "success": false,
  "message": "Server error generating admin dashboard",
  "error": "Detailed error message"
}
```

---

## Use Cases

### **1. Platform Health Monitoring**
- Track total users and their verification status
- Monitor project completion rates
- Assess financial performance

### **2. User Engagement Analysis**
- View conversion rates at each step
- Identify top performing annotators
- Track recent registration trends

### **3. Financial Oversight**
- Monitor payment rates and outstanding balances
- Track revenue generation
- Identify overdue payments

### **4. Operational Insights**
- See which domains are most popular
- Track recent platform activity
- Monitor project and application flow

---

## Rate Limiting

- **10 requests per minute** for dashboard endpoint
- Rate limit resets every minute
- Exceeding limit returns 429 Too Many Requests

---

## Example Implementation

### JavaScript/React Example:
```javascript
const fetchAdminDashboard = async (token) => {
  try {
    const response = await fetch('/api/admin/dashboard', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Dashboard Data:', data.data);
      // Update your dashboard UI with the data
      updateDashboardUI(data.data);
    } else {
      console.error('Dashboard Error:', data.message);
    }
  } catch (error) {
    console.error('Network Error:', error);
  }
};

const updateDashboardUI = (dashboardData) => {
  // Update overview cards
  document.getElementById('total-users').textContent = dashboardData.overview.totalUsers;
  document.getElementById('total-revenue').textContent = `$${dashboardData.overview.totalRevenue}`;
  
  // Update conversion rates
  document.getElementById('approval-rate').textContent = `${dashboardData.insights.conversionRates.approvalRate}%`;
  
  // Update top performers list
  const topAnnotators = dashboardData.topPerformers.topAnnotators;
  // Render top annotators in UI...
};
```

### Node.js/Express Example:
```javascript
const axios = require('axios');

const getAdminDashboard = async (adminToken) => {
  try {
    const response = await axios.get('http://localhost:5000/api/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Dashboard fetch error:', error.response?.data || error.message);
    throw error;
  }
};
```

---

## Testing

### Interactive Test Interface:
Use the provided `test-admin-dashboard.html` file:
1. Open the file in your browser
2. Enter your admin JWT token
3. Click "Get Dashboard Data" 
4. View both raw JSON and formatted statistics

### Manual Testing Steps:
1. **Login as Admin**:
   ```bash
   curl -X POST http://localhost:5000/api/admin/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@mydeeptech.ng","password":"your_password"}'
   ```

2. **Copy JWT Token** from login response

3. **Test Dashboard**:
   ```bash
   curl -X GET http://localhost:5000/api/admin/dashboard \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

---

## Notes

- Dashboard data is computed in real-time from the database
- All timestamps are in ISO 8601 format (UTC)
- Monetary amounts are in the currency specified in invoices
- Registration trends cover the last 30 days
- Invoice activity covers the last 7 days
- Top performers are limited to 10 annotators
- Recent activities show the latest 10 users and 5 projects
- Admin accounts are excluded from DTUser statistics

---

*Last updated: November 11, 2025*