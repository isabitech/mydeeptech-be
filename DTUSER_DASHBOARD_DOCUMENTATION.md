# DTUser Personal Dashboard Documentation

## Overview
The DTUser Dashboard provides authenticated DTUsers with a comprehensive personal overview of their profile, applications, financial status, and opportunities within the platform. This dashboard serves as the central hub for DTUsers to monitor their progress, track earnings, manage applications, and receive personalized recommendations.

## Endpoint Details

### GET /dashboard
**Description:** Retrieve personal dashboard data for the authenticated DTUser

**Authentication:** Required (DTUser JWT token)

**Base URL:** `http://localhost:8800/api/dashboard`

---

## Request Format

### Headers
```http
Authorization: Bearer <dtuser_jwt_token>
Content-Type: application/json
```

### Query Parameters
None required - dashboard automatically generates data for the authenticated user

---

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "userProfile": {
      "id": "user_object_id",
      "fullName": "User Full Name",
      "email": "user@example.com",
      "annotatorStatus": "approved",
      "microTaskerStatus": "pending",
      "isEmailVerified": true,
      "hasSetPassword": true,
      "joinedDate": "2024-01-15T10:30:00.000Z",
      "profilePicture": "cloudinary_url_or_null"
    },
    "profileCompletion": {
      "percentage": 85,
      "sections": {
        "basicInfo": {
          "completed": true,
          "fields": ["fullName", "email", "phone"]
        },
        "personalInfo": {
          "completed": true,
          "fields": ["country", "time_zone", "available_hours_per_week"]
        },
        "professionalBackground": {
          "completed": false,
          "fields": ["education_field", "years_of_experience"]
        },
        "paymentInfo": {
          "completed": true,
          "fields": ["account_name", "account_number", "bank_name"]
        },
        "attachments": {
          "completed": false,
          "fields": ["resume_url", "id_document_url"]
        },
        "profilePicture": {
          "completed": true,
          "fields": ["profile_picture"]
        }
      },
      "completedSections": 4,
      "totalSections": 6
    },
    "applicationStatistics": {
      "totalApplications": 12,
      "pendingApplications": 3,
      "approvedApplications": 7,
      "rejectedApplications": 2
    },
    "financialSummary": {
      "totalInvoices": 8,
      "totalEarnings": 2450.00,
      "paidEarnings": 1950.00,
      "pendingEarnings": 500.00,
      "overdueEarnings": 0.00,
      "paidInvoices": 6,
      "pendingInvoices": 2,
      "overdueInvoices": 0
    },
    "resultSubmissions": {
      "totalSubmissions": 5,
      "recentSubmissions": [
        {
          "_id": "submission_id",
          "submissionDate": "2024-01-20T14:30:00.000Z",
          "status": "stored",
          "notes": "Project completion"
        }
      ],
      "lastSubmissionDate": 1705757400000
    },
    "recentActivity": {
      "recentApplications": [
        {
          "_id": "application_id",
          "status": "approved",
          "appliedAt": "2024-01-18T09:15:00.000Z",
          "projectId": {
            "_id": "project_id",
            "projectName": "Image Annotation Project",
            "budget": 500,
            "timeline": "2 weeks",
            "status": "active"
          }
        }
      ],
      "recentInvoices": [
        {
          "_id": "invoice_id",
          "invoiceAmount": 250.00,
          "paymentStatus": "paid",
          "dueDate": "2024-01-25T00:00:00.000Z",
          "paidAt": "2024-01-23T16:45:00.000Z",
          "createdAt": "2024-01-15T10:00:00.000Z",
          "projectId": {
            "_id": "project_id",
            "projectName": "Data Classification Task"
          }
        }
      ],
      "recentPayments": [
        {
          "_id": {
            "year": 2024,
            "month": 1,
            "day": 23
          },
          "dailyEarnings": 250.00,
          "invoiceCount": 1
        }
      ]
    },
    "availableOpportunities": {
      "availableProjects": [
        {
          "_id": "project_id",
          "projectName": "New Text Analysis Project",
          "description": "Analyze and categorize text data",
          "budget": 750,
          "timeline": "3 weeks",
          "requirements": {
            "maxAnnotators": 10,
            "skills": ["text analysis", "categorization"],
            "experience_level": "intermediate"
          },
          "status": "active",
          "hasApplied": false,
          "applicationStatus": null
        }
      ],
      "projectCount": 5
    },
    "performanceMetrics": {
      "profileCompletionPercentage": 85,
      "applicationSuccessRate": 58,
      "paymentRate": 75,
      "avgEarningsPerInvoice": 306,
      "accountStatus": {
        "annotatorStatus": "approved",
        "microTaskerStatus": "pending",
        "isEmailVerified": true,
        "hasSetPassword": true
      }
    },
    "recommendations": {
      "nextSteps": [
        {
          "priority": "medium",
          "action": "complete_profile",
          "title": "Complete Your Profile",
          "description": "Your profile is 85% complete. Add missing information to improve your chances of approval."
        },
        {
          "priority": "medium",
          "action": "upload_resume",
          "title": "Upload Resume",
          "description": "Upload your resume to showcase your experience"
        }
      ],
      "priorityActions": 0
    },
    "generatedAt": "2024-01-20T15:30:00.000Z",
    "timeframe": {
      "recentActivity": "30 days",
      "availableProjects": "current active projects"
    }
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. Token is required."
}
```

#### 404 User Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```

#### 500 Server Error
```json
{
  "success": false,
  "message": "Server error generating user dashboard",
  "error": "Detailed error message"
}
```

---

## Data Field Explanations

### User Profile Section
- **id**: Unique user identifier
- **annotatorStatus**: Current status (pending, verified, submitted, approved, rejected)
- **microTaskerStatus**: Micro-tasking eligibility status
- **isEmailVerified**: Email verification status
- **hasSetPassword**: Whether user has completed password setup

### Profile Completion Analysis
- **percentage**: Overall completion rate (0-100%)
- **sections**: Detailed breakdown of profile sections
- **completedSections**: Number of fully completed sections
- **totalSections**: Total number of profile sections

### Application Statistics
- **totalApplications**: All project applications submitted
- **pendingApplications**: Applications awaiting review
- **approvedApplications**: Successfully accepted applications
- **rejectedApplications**: Declined applications

### Financial Summary
- **totalEarnings**: All-time earnings across all invoices
- **paidEarnings**: Successfully paid amounts
- **pendingEarnings**: Outstanding unpaid amounts
- **overdueEarnings**: Overdue payment amounts
- **Invoice counts**: Breakdown by payment status

### Result Submissions
- **totalSubmissions**: Number of work samples submitted
- **recentSubmissions**: Latest 5 submissions with details
- **lastSubmissionDate**: Timestamp of most recent submission

### Recent Activity (30 days)
- **recentApplications**: Latest 5 project applications with project details
- **recentInvoices**: Latest 5 invoices with payment information
- **recentPayments**: Daily earnings breakdown for recent payments

### Available Opportunities
- **availableProjects**: Current active projects user can apply to
- **hasApplied**: Whether user has already applied to each project
- **applicationStatus**: Current status if applied (pending, approved, rejected)

### Performance Metrics
- **profileCompletionPercentage**: Profile completion rate
- **applicationSuccessRate**: Approval rate for project applications
- **paymentRate**: Percentage of invoices that have been paid
- **avgEarningsPerInvoice**: Average earning per invoice

### Recommendations
- **nextSteps**: Personalized action items for user improvement
- **priority**: Action priority (high, medium, low)
- **priorityActions**: Count of high-priority recommended actions

---

## Use Cases

### 1. Profile Management
**Scenario**: User wants to improve their profile completion rate

**Dashboard Insights**:
- View current completion percentage
- Identify missing profile sections
- Get specific recommendations for improvement

### 2. Application Tracking
**Scenario**: User wants to monitor project application status

**Dashboard Insights**:
- View application success rate
- See recent application outcomes
- Track pending applications

### 3. Financial Monitoring
**Scenario**: User wants to track earnings and payments

**Dashboard Insights**:
- View total and recent earnings
- Monitor payment status of invoices
- Track payment rate performance

### 4. Opportunity Discovery
**Scenario**: User wants to find new projects to apply to

**Dashboard Insights**:
- Browse available active projects
- See application requirements
- Check if already applied to projects

### 5. Performance Analysis
**Scenario**: User wants to understand their platform performance

**Dashboard Insights**:
- View key performance metrics
- Get personalized recommendations
- Track progress over time

---

## Frontend Integration Examples

### React/JavaScript Integration
```javascript
const fetchDTUserDashboard = async () => {
  try {
    const token = localStorage.getItem('dtuser_token');
    
    const response = await fetch('/api/dashboard', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const dashboardData = await response.json();
    
    if (dashboardData.success) {
      // Use dashboard data to populate UI
      updateDashboardUI(dashboardData.data);
    } else {
      console.error('Dashboard fetch failed:', dashboardData.message);
    }
  } catch (error) {
    console.error('Dashboard request error:', error);
  }
};

const updateDashboardUI = (data) => {
  // Update profile completion progress bar
  const completionBar = document.getElementById('completion-progress');
  completionBar.style.width = `${data.profileCompletion.percentage}%`;
  
  // Display financial summary
  document.getElementById('total-earnings').textContent = `$${data.financialSummary.totalEarnings}`;
  document.getElementById('pending-earnings').textContent = `$${data.financialSummary.pendingEarnings}`;
  
  // Show application stats
  document.getElementById('total-applications').textContent = data.applicationStatistics.totalApplications;
  document.getElementById('success-rate').textContent = `${data.performanceMetrics.applicationSuccessRate}%`;
  
  // Display recommendations
  const recommendationsList = document.getElementById('recommendations');
  data.recommendations.nextSteps.forEach(step => {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <span class="priority-${step.priority}">${step.title}</span>
      <p>${step.description}</p>
    `;
    recommendationsList.appendChild(listItem);
  });
};
```

### Dashboard Update Frequency
- **Real-time data**: Profile information, application status
- **Daily updates**: Financial summaries, performance metrics
- **Weekly updates**: Available opportunities, recommendations
- **Manual refresh**: User can refresh dashboard data on demand

---

## Security and Privacy

### Data Protection
- All personal information is protected by JWT authentication
- Dashboard only displays data belonging to the authenticated user
- No sensitive payment details are exposed in dashboard responses
- User passwords and sensitive tokens are excluded from all responses

### Access Control
- Endpoint requires valid DTUser authentication token
- Users can only access their own dashboard data
- Invalid tokens result in immediate access denial
- Expired tokens require re-authentication

---

## Performance Considerations

### Data Aggregation
- Efficient MongoDB aggregation pipelines for statistics calculation
- Pagination for large datasets (applications, invoices, submissions)
- Cached calculations where appropriate for performance optimization

### Response Optimization
- Selective field inclusion to minimize response size
- Recent activity limited to 30 days for faster queries
- Available projects limited to 5 most relevant matches

---

## Error Handling

### Common Issues
1. **Invalid Token**: User needs to re-authenticate
2. **User Not Found**: Account may have been deactivated
3. **Database Connection**: Temporary service unavailable
4. **Data Processing**: Specific aggregation or calculation errors

### Debugging
- Comprehensive server-side logging for all dashboard requests
- Error tracking with detailed context information
- Performance monitoring for slow aggregation queries

---

## Testing

### Manual Testing
You can test the DTUser dashboard using curl or Postman:

```bash
curl -X GET http://localhost:8800/api/dashboard \
  -H "Authorization: Bearer YOUR_DTUSER_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Response Time
- **Optimal**: < 500ms for users with moderate data
- **Acceptable**: < 2s for users with extensive activity history
- **Timeout**: > 10s indicates potential performance issues

---

## Related Endpoints

### Profile Management
- `GET /api/dtUserProfile/:userId` - Detailed profile information
- `PATCH /api/dtUserProfile/:userId` - Update profile data

### Application Management
- `GET /api/projects` - Browse available projects
- `POST /api/projects/:projectId/apply` - Apply to specific project

### Financial Management
- `GET /api/invoices/dashboard` - Detailed financial dashboard
- `GET /api/invoices` - List all user invoices

### Result Management
- `POST /api/submit-result` - Submit work samples
- `GET /api/result-submissions` - View submission history

---

This documentation provides comprehensive information for developers implementing and using the DTUser Dashboard endpoint. The dashboard serves as a central hub for DTUser account management and performance tracking within the platform.