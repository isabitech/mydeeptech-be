# Project Details with Annotators List - API Documentation

## Overview
The enhanced `/api/admin/projects/:projectId` endpoint now provides comprehensive information about approved, rejected, and pending annotators for a specific project. This allows admins to view detailed annotator lists with their profiles, application status, and review history.

## Endpoint Details

### GET /api/admin/projects/:projectId
**Description:** Retrieve detailed information about a specific annotation project including all annotators lists

**Authentication:** Required (Admin JWT token)

**Base URL:** `http://localhost:8800/api/admin/projects/:projectId`

---

## Request Format

### Headers
```http
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

### URL Parameters
- `projectId` (required): The MongoDB ObjectId of the annotation project

---

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "Annotation project details retrieved successfully",
  "data": {
    "project": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "projectName": "Image Classification Project",
      "projectDescription": "Classify images into categories",
      "projectCategory": "Image Annotation",
      "payRate": 5,
      "payRateCurrency": "USD",
      "payRateType": "per_task",
      "status": "active",
      "maxAnnotators": 10,
      "deadline": "2024-02-15T00:00:00.000Z",
      "difficultyLevel": "intermediate",
      "requiredSkills": ["image classification", "attention to detail"],
      "minimumExperience": "beginner",
      "languageRequirements": ["English"],
      "tags": ["AI", "machine learning", "computer vision"],
      "totalApplications": 15,
      "approvedAnnotators": 8,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-20T14:30:00.000Z",
      "createdBy": {
        "_id": "admin_id",
        "fullName": "Project Manager",
        "email": "pm@mydeeptech.ng",
        "phone": "+1234567890"
      },
      "assignedAdmins": [
        {
          "_id": "admin_id",
          "fullName": "Project Manager",
          "email": "pm@mydeeptech.ng",
          "phone": "+1234567890"
        }
      ]
    },
    "applicationStats": {
      "pending": 3,
      "approved": 8,
      "rejected": 4
    },
    "annotatorStats": {
      "total": 15,
      "approved": 8,
      "rejected": 4,
      "pending": 3,
      "approvalRate": 67
    },
    "recentApplications": [
      {
        "_id": "recent_application_id",
        "status": "pending",
        "appliedAt": "2024-01-20T10:00:00.000Z",
        "applicantId": {
          "_id": "user_id",
          "fullName": "John Doe",
          "email": "john@example.com",
          "annotatorStatus": "approved"
        }
      }
    ],
    "annotators": {
      "approved": [
        {
          "applicationId": "app_id_1",
          "applicationStatus": "approved",
          "appliedAt": "2024-01-18T09:00:00.000Z",
          "reviewedAt": "2024-01-19T14:30:00.000Z",
          "reviewedBy": {
            "_id": "admin_id",
            "fullName": "Review Admin",
            "email": "admin@mydeeptech.ng"
          },
          "reviewNotes": "Excellent qualifications and experience",
          "rejectionReason": null,
          "coverLetter": "I am excited to work on this project...",
          "workStartedAt": "2024-01-19T14:30:00.000Z",
          "annotator": {
            "id": "annotator_id_1",
            "fullName": "Alice Johnson",
            "email": "alice@example.com",
            "phone": "+1234567890",
            "annotatorStatus": "approved",
            "microTaskerStatus": "pending",
            "profilePicture": "https://cloudinary.com/profile.jpg",
            "joinedDate": "2024-01-10T08:00:00.000Z",
            "personalInfo": {
              "country": "United States",
              "timeZone": "America/New_York",
              "availableHours": 20,
              "languages": ["English", "Spanish"]
            },
            "professionalBackground": {
              "educationField": "Computer Science",
              "yearsOfExperience": "2-5",
              "previousProjects": ["Image tagging", "Data labeling"],
              "skills": ["Machine Learning", "Data Annotation", "Quality Control"]
            },
            "paymentInfo": {
              "hasPaymentInfo": true,
              "accountName": "Alice Johnson",
              "bankName": "Chase Bank"
            },
            "attachments": {
              "hasResume": true,
              "hasIdDocument": true,
              "resumeUrl": "https://cloudinary.com/resume.pdf",
              "idDocumentUrl": "https://cloudinary.com/id.pdf"
            }
          }
        }
      ],
      "rejected": [
        {
          "applicationId": "app_id_2",
          "applicationStatus": "rejected",
          "appliedAt": "2024-01-17T11:00:00.000Z",
          "reviewedAt": "2024-01-18T16:00:00.000Z",
          "reviewedBy": {
            "_id": "admin_id",
            "fullName": "Review Admin",
            "email": "admin@mydeeptech.ng"
          },
          "reviewNotes": "Insufficient experience for this project",
          "rejectionReason": "insufficient_experience",
          "coverLetter": "I would like to work on this project...",
          "workStartedAt": null,
          "annotator": {
            "id": "annotator_id_2",
            "fullName": "Bob Smith",
            "email": "bob@example.com",
            "phone": "+0987654321",
            "annotatorStatus": "verified",
            "microTaskerStatus": "pending",
            "profilePicture": null,
            "joinedDate": "2024-01-12T10:00:00.000Z",
            "personalInfo": {
              "country": "Canada",
              "timeZone": "America/Toronto",
              "availableHours": 15,
              "languages": ["English", "French"]
            },
            "professionalBackground": {
              "educationField": "Business",
              "yearsOfExperience": "less than 1",
              "previousProjects": [],
              "skills": ["Data Entry"]
            },
            "paymentInfo": {
              "hasPaymentInfo": false,
              "accountName": null,
              "bankName": null
            },
            "attachments": {
              "hasResume": false,
              "hasIdDocument": true,
              "resumeUrl": null,
              "idDocumentUrl": "https://cloudinary.com/bob_id.pdf"
            }
          }
        }
      ],
      "pending": [
        {
          "applicationId": "app_id_3",
          "applicationStatus": "pending",
          "appliedAt": "2024-01-20T14:00:00.000Z",
          "reviewedAt": null,
          "reviewedBy": null,
          "reviewNotes": null,
          "rejectionReason": null,
          "coverLetter": "I have experience in image classification...",
          "workStartedAt": null,
          "annotator": {
            "id": "annotator_id_3",
            "fullName": "Carol Williams",
            "email": "carol@example.com",
            "phone": "+1122334455",
            "annotatorStatus": "approved",
            "microTaskerStatus": "approved",
            "profilePicture": "https://cloudinary.com/carol.jpg",
            "joinedDate": "2024-01-05T12:00:00.000Z",
            "personalInfo": {
              "country": "United Kingdom",
              "timeZone": "Europe/London",
              "availableHours": 25,
              "languages": ["English"]
            },
            "professionalBackground": {
              "educationField": "Data Science",
              "yearsOfExperience": "1-2",
              "previousProjects": ["Text annotation", "Image classification"],
              "skills": ["Python", "Machine Learning", "Computer Vision"]
            },
            "paymentInfo": {
              "hasPaymentInfo": true,
              "accountName": "Carol Williams",
              "bankName": "Barclays"
            },
            "attachments": {
              "hasResume": true,
              "hasIdDocument": true,
              "resumeUrl": "https://cloudinary.com/carol_resume.pdf",
              "idDocumentUrl": "https://cloudinary.com/carol_id.pdf"
            }
          }
        }
      ]
    },
    "recentReviewActivity": [
      {
        "_id": "review_activity_1",
        "status": "approved",
        "reviewedAt": "2024-01-20T11:30:00.000Z",
        "reviewNotes": "Great portfolio and experience",
        "rejectionReason": null,
        "applicantId": {
          "_id": "user_id",
          "fullName": "Alice Johnson",
          "email": "alice@example.com"
        },
        "reviewedBy": {
          "_id": "admin_id",
          "fullName": "Review Admin",
          "email": "admin@mydeeptech.ng"
        }
      }
    ]
  }
}
```

### Error Responses

#### 404 Project Not Found
```json
{
  "success": false,
  "message": "Annotation project not found"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. Admin authentication required."
}
```

#### 500 Server Error
```json
{
  "success": false,
  "message": "Server error fetching annotation project details",
  "error": "Detailed error message"
}
```

---

## Data Field Explanations

### Project Information
- **Basic Details**: Project name, description, category, pay rate, status
- **Requirements**: Skills, experience level, language requirements
- **Limits**: Max annotators, deadline, difficulty level
- **Creator Info**: Admin who created the project and assigned admins

### Application Statistics
- **pending**: Number of applications awaiting review
- **approved**: Number of approved applications
- **rejected**: Number of rejected applications

### Annotator Statistics
- **total**: Total number of applicants
- **approved**: Number of approved annotators
- **rejected**: Number of rejected annotators
- **pending**: Number of pending applications
- **approvalRate**: Percentage of reviewed applications that were approved

### Annotator Details (for each annotator)
- **Application Info**: Status, dates, review notes, cover letter
- **Personal Info**: Contact details, location, availability
- **Professional Background**: Education, experience, skills, previous projects
- **Payment Info**: Banking details availability (sensitive data hidden)
- **Attachments**: Resume and ID document availability

### Recent Review Activity
- **Latest Reviews**: Recent approval/rejection decisions
- **Review Details**: Admin who reviewed, notes, timestamps
- **Action History**: Track of recent administrative actions

---

## Use Cases

### 1. Project Management
**Scenario**: Admin wants to see all annotators working on a project

**Endpoint Benefits**:
- View complete list of approved annotators
- See their skills and experience levels
- Monitor project team composition

### 2. Quality Assurance
**Scenario**: Admin needs to review annotator qualifications

**Endpoint Benefits**:
- Access detailed annotator profiles
- Review previous project experience
- Verify skill alignment with project requirements

### 3. Application Review
**Scenario**: Admin reviewing pending applications

**Endpoint Benefits**:
- See pending applications with full context
- Compare against already approved annotators
- Make informed approval/rejection decisions

### 4. Performance Tracking
**Scenario**: Admin monitoring project recruitment success

**Endpoint Benefits**:
- View approval rates and statistics
- Identify patterns in applications
- Track review activity and decisions

### 5. Team Management
**Scenario**: Admin managing project workforce

**Endpoint Benefits**:
- Contact information for approved annotators
- Availability and work hour information
- Payment setup status for all team members

---

## Frontend Integration Examples

### React/JavaScript Integration
```javascript
const fetchProjectDetails = async (projectId) => {
  try {
    const token = localStorage.getItem('admin_token');
    
    const response = await fetch(`/api/admin/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const projectData = await response.json();
    
    if (projectData.success) {
      displayProjectDetails(projectData.data);
    } else {
      console.error('Failed to fetch project details:', projectData.message);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

const displayProjectDetails = (data) => {
  // Display project information
  document.getElementById('project-name').textContent = data.project.projectName;
  document.getElementById('project-category').textContent = data.project.projectCategory;
  
  // Display annotator statistics
  document.getElementById('total-annotators').textContent = data.annotatorStats.total;
  document.getElementById('approved-count').textContent = data.annotatorStats.approved;
  document.getElementById('rejected-count').textContent = data.annotatorStats.rejected;
  document.getElementById('pending-count').textContent = data.annotatorStats.pending;
  document.getElementById('approval-rate').textContent = `${data.annotatorStats.approvalRate}%`;
  
  // Display approved annotators list
  const approvedList = document.getElementById('approved-annotators');
  approvedList.innerHTML = '';
  
  data.annotators.approved.forEach(app => {
    const annotator = app.annotator;
    const listItem = document.createElement('div');
    listItem.className = 'annotator-card approved';
    listItem.innerHTML = `
      <div class="annotator-header">
        <img src="${annotator.profilePicture || '/default-avatar.png'}" alt="${annotator.fullName}">
        <div class="annotator-info">
          <h4>${annotator.fullName}</h4>
          <p>${annotator.email}</p>
          <span class="status-badge ${annotator.annotatorStatus}">${annotator.annotatorStatus}</span>
        </div>
      </div>
      <div class="annotator-details">
        <p><strong>Country:</strong> ${annotator.personalInfo.country}</p>
        <p><strong>Experience:</strong> ${annotator.professionalBackground.yearsOfExperience}</p>
        <p><strong>Skills:</strong> ${annotator.professionalBackground.skills.join(', ')}</p>
        <p><strong>Available Hours:</strong> ${annotator.personalInfo.availableHours}/week</p>
        <p><strong>Approved:</strong> ${new Date(app.reviewedAt).toLocaleDateString()}</p>
        <p><strong>Reviewed by:</strong> ${app.reviewedBy.fullName}</p>
        ${app.reviewNotes ? `<p><strong>Notes:</strong> ${app.reviewNotes}</p>` : ''}
      </div>
    `;
    approvedList.appendChild(listItem);
  });
  
  // Display rejected annotators list
  const rejectedList = document.getElementById('rejected-annotators');
  rejectedList.innerHTML = '';
  
  data.annotators.rejected.forEach(app => {
    const annotator = app.annotator;
    const listItem = document.createElement('div');
    listItem.className = 'annotator-card rejected';
    listItem.innerHTML = `
      <div class="annotator-header">
        <img src="${annotator.profilePicture || '/default-avatar.png'}" alt="${annotator.fullName}">
        <div class="annotator-info">
          <h4>${annotator.fullName}</h4>
          <p>${annotator.email}</p>
          <span class="status-badge ${annotator.annotatorStatus}">${annotator.annotatorStatus}</span>
        </div>
      </div>
      <div class="annotator-details">
        <p><strong>Country:</strong> ${annotator.personalInfo.country}</p>
        <p><strong>Experience:</strong> ${annotator.professionalBackground.yearsOfExperience}</p>
        <p><strong>Rejected:</strong> ${new Date(app.reviewedAt).toLocaleDateString()}</p>
        <p><strong>Reason:</strong> ${app.rejectionReason || 'Not specified'}</p>
        <p><strong>Reviewed by:</strong> ${app.reviewedBy.fullName}</p>
        ${app.reviewNotes ? `<p><strong>Notes:</strong> ${app.reviewNotes}</p>` : ''}
      </div>
    `;
    rejectedList.appendChild(listItem);
  });
  
  // Display pending annotators
  const pendingList = document.getElementById('pending-annotators');
  pendingList.innerHTML = '';
  
  data.annotators.pending.forEach(app => {
    const annotator = app.annotator;
    const listItem = document.createElement('div');
    listItem.className = 'annotator-card pending';
    listItem.innerHTML = `
      <div class="annotator-header">
        <img src="${annotator.profilePicture || '/default-avatar.png'}" alt="${annotator.fullName}">
        <div class="annotator-info">
          <h4>${annotator.fullName}</h4>
          <p>${annotator.email}</p>
          <span class="status-badge ${annotator.annotatorStatus}">${annotator.annotatorStatus}</span>
        </div>
      </div>
      <div class="annotator-details">
        <p><strong>Country:</strong> ${annotator.personalInfo.country}</p>
        <p><strong>Experience:</strong> ${annotator.professionalBackground.yearsOfExperience}</p>
        <p><strong>Skills:</strong> ${annotator.professionalBackground.skills.join(', ')}</p>
        <p><strong>Applied:</strong> ${new Date(app.appliedAt).toLocaleDateString()}</p>
        <div class="action-buttons">
          <button onclick="approveApplication('${app.applicationId}')" class="btn btn-success">
            Approve
          </button>
          <button onclick="rejectApplication('${app.applicationId}')" class="btn btn-danger">
            Reject
          </button>
        </div>
      </div>
    `;
    pendingList.appendChild(listItem);
  });
};
```

### CSS for Annotator Cards
```css
.annotator-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.annotator-card.approved {
  border-left: 4px solid #27ae60;
}

.annotator-card.rejected {
  border-left: 4px solid #e74c3c;
}

.annotator-card.pending {
  border-left: 4px solid #f39c12;
}

.annotator-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.annotator-header img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  margin-right: 15px;
}

.annotator-info h4 {
  margin: 0;
  color: #2c3e50;
}

.annotator-info p {
  margin: 5px 0;
  color: #666;
}

.status-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.status-badge.approved { background: #d4edda; color: #155724; }
.status-badge.pending { background: #fff3cd; color: #856404; }
.status-badge.verified { background: #cce7ff; color: #004085; }

.annotator-details p {
  margin: 5px 0;
  font-size: 14px;
}

.action-buttons {
  margin-top: 10px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-right: 5px;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}
```

---

## Performance Considerations

### Data Optimization
- **Selective Population**: Only necessary fields are populated from referenced documents
- **Pagination Ready**: Structure supports future pagination of annotator lists
- **Efficient Queries**: Separate queries optimize for different data needs

### Response Size Management
- **Lazy Loading**: Large lists can be paginated in future versions
- **Field Selection**: Only relevant annotator data is included
- **Compressed Format**: Structured data minimizes response size

---

## Security and Privacy

### Data Protection
- **Sensitive Data Hidden**: Payment details are abstracted (hasPaymentInfo flag only)
- **Admin Access Only**: Requires admin authentication for all data
- **Selective Exposure**: Only necessary profile information is included

### Privacy Compliance
- **Contact Information**: Only included for approved/project-related access
- **Document URLs**: Secure Cloudinary URLs with access controls
- **Personal Data**: Limited to project-relevant information only

---

## Testing

### Manual Testing
```bash
# Get project details with annotators
curl -X GET "http://localhost:8800/api/admin/projects/64f8a1b2c3d4e5f6a7b8c9d0" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Response Time
- **Small Projects** (< 20 annotators): < 500ms
- **Medium Projects** (20-100 annotators): < 1s  
- **Large Projects** (100+ annotators): < 2s

---

## Related Endpoints

### Application Management
- `PATCH /api/admin/applications/:applicationId/approve` - Approve specific application
- `PATCH /api/admin/applications/:applicationId/reject` - Reject specific application
- `GET /api/admin/applications` - List all applications across projects

### Project Management
- `GET /api/admin/projects` - List all projects
- `PATCH /api/admin/projects/:projectId` - Update project details
- `DELETE /api/admin/projects/:projectId` - Delete project

### Annotator Management
- `GET /api/admin/dtusers` - List all DTUsers/annotators
- `GET /api/admin/dtusers/:userId` - Get specific annotator details

---

This enhanced endpoint provides comprehensive visibility into project annotator lists, enabling effective project management, quality assurance, and team coordination for annotation projects.