# MyDeepTech API Documentation

## Overview
Complete API documentation for MyDeepTech annotation platform with resume requirements and project resource management.

## Base URL
- Development: `http://localhost:4000/api`
- Production: `https://api.mydeeptech.ng/api`

## Authentication
Most endpoints require JWT token authentication. Include the token in the Authorization header:
```
Authorization: Bearer your_jwt_token_here
```

## Key Features
- 📄 **Resume Requirement**: Users must upload resume before applying to projects
- 🔗 **Project Resources**: Guidelines, videos, community links, and progress trackers
- 📁 **File Upload**: Cloudinary integration with raw resource type for PDFs
- ✉️ **Email Integration**: Enhanced notifications with resource links

---

## Authentication

### POST /auth/dtUserRegister
Create a new user account for the annotation platform

#### Request Body
```json
{
  "type": "object",
  "required": [
    "fullName",
    "email",
    "phone",
    "consent"
  ],
  "properties": {
    "fullName": {
      "type": "string",
      "example": "John Doe"
    },
    "email": {
      "type": "string",
      "format": "email",
      "example": "john@example.com"
    },
    "phone": {
      "type": "string",
      "example": "+1234567890"
    },
    "consent": {
      "type": "boolean",
      "example": true
    },
    "domains": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "example": [
        "technology",
        "healthcare"
      ]
    }
  }
}
```

#### Responses
- **201**: User registered successfully
- **400**: Validation error

---

### POST /auth/dtUserLogin
Authenticate user and return JWT token

#### Request Body
```json
{
  "type": "object",
  "required": [
    "email",
    "password"
  ],
  "properties": {
    "email": {
      "type": "string",
      "format": "email",
      "example": "john@example.com"
    },
    "password": {
      "type": "string",
      "example": "securePassword123"
    }
  }
}
```

#### Responses
- **200**: Login successful, returns JWT token
- **401**: Invalid credentials

---

## FileUpload

### POST /auth/upload-resume
Upload resume file (PDF, DOC, DOCX) to user profile - REQUIRED for project applications

🔐 **Requires Authentication**

#### Request Body
```json
{
  "type": "object",
  "properties": {
    "resume": {
      "type": "string",
      "format": "binary",
      "description": "Resume file (PDF, DOC, DOCX)"
    }
  }
}
```

#### Responses
- **200**: Resume uploaded successfully with accessible URL
- **400**: File validation error or missing file
- **401**: Authentication required

#### Important Notes
- Files are stored with resource_type: raw for proper accessibility
- Supported formats: PDF, DOC, DOCX
- Maximum file size: 10MB
- Resume is required before applying to any project

---

### POST /auth/upload-id-document
Upload identification document (PDF, JPG, PNG) to user profile

🔐 **Requires Authentication**

#### Request Body
```json
{
  "type": "object",
  "properties": {
    "idDocument": {
      "type": "string",
      "format": "binary",
      "description": "ID document file (PDF, JPG, PNG)"
    }
  }
}
```

#### Responses
- **200**: ID document uploaded successfully
- **400**: File validation error

---

## Projects

### GET /auth/projects/available
Retrieve list of active projects available for applications

🔐 **Requires Authentication**

#### Parameters
- **page** (query): integer - Page number
- **limit** (query): integer - Items per page
- **category** (query): string - Filter by category

#### Responses
- **200**: Available projects retrieved successfully
- **403**: Access denied - user not approved

---

### POST /auth/projects/{projectId}/apply
Submit an application to an annotation project (requires uploaded resume)

🔐 **Requires Authentication**

#### Parameters
- **projectId** (path): string - Project ID

#### Request Body
```json
{
  "type": "object",
  "properties": {
    "coverLetter": {
      "type": "string",
      "example": "I am interested in this project..."
    },
    "proposedRate": {
      "type": "number",
      "example": 15
    },
    "availability": {
      "type": "string",
      "enum": [
        "full_time",
        "part_time",
        "weekends",
        "flexible"
      ]
    },
    "estimatedCompletionTime": {
      "type": "string",
      "example": "2 weeks"
    }
  }
}
```

#### Responses
- **201**: Application submitted successfully
- **400**: Resume required or validation error
- **403**: Access denied - user not approved annotator
- **404**: Project not found

#### Important Notes
- Resume must be uploaded to user profile before applying
- User must have approved annotator status
- Application deadline must not have passed
- Project must be active and accepting applications

---

### GET /auth/projects/{projectId}/guidelines
Access project guidelines and resources (only for approved applicants)

🔐 **Requires Authentication**

#### Parameters
- **projectId** (path): string - Project ID

#### Responses
- **200**: Project guidelines retrieved successfully
- **403**: Access denied - user not approved for this project

---

