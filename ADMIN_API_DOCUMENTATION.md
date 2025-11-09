# Admin API Endpoints Documentation

## Base URL
```
http://localhost:5000/api/admin
```

---

## 🔐 **Authentication Endpoints**

### 1. Admin Login
```http
POST /admin/login
```
**Purpose**: Login with email and password after account verification  
**Request Body**:
```json
{
  "email": "admin@mydeeptech.ng",
  "password": "YourPassword123!"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Admin login successful",
  "_usrinfo": {
    "data": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "Admin Name",
    "email": "admin@mydeeptech.ng",
    "phone": "+1234567890",
    "domains": ["Administration", "Management"],
    "isEmailVerified": true,
    "hasSetPassword": true,
    "annotatorStatus": "approved",
    "microTaskerStatus": "approved",
    "createdAt": "2025-11-09T10:22:01.000Z",
    "isAdmin": true,
    "role": "admin"
  }
}
```

### 2. Create Admin Account (Direct)
```http
POST /admin/create
```
**Purpose**: Create admin account directly (legacy method)  
**Request Body**:
```json
{
  "fullName": "Admin Name",
  "email": "admin@mydeeptech.ng",
  "phone": "+1234567890",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!",
  "adminKey": "super-secret-admin-key-2024"
}
```

### 3. Verify Admin OTP
```http
POST /admin/verify-otp
```
**Purpose**: Verify admin email with OTP code received via email  
**Request Body**:
```json
{
  "email": "admin@mydeeptech.ng",
  "verificationCode": "123456",
  "adminKey": "super-secret-admin-key-2024"
}
```
**Response**: Returns JWT token and verified admin details

---

## � **DTUser Endpoints**

### 9. Reset DTUser Password
```http
PATCH /auth/dtUserResetPassword
```
**Purpose**: Reset user password (requires current password)  
**Headers**: `Authorization: Bearer <jwt_token>`  
**Request Body**:
```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewPassword123!",
  "confirmNewPassword": "NewPassword123!"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Password reset successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "fullName": "User Name",
    "email": "user@example.com",
    "hasSetPassword": true,
    "updatedAt": "2025-11-09T10:22:01.000Z"
  }
}
```

**Error Responses**:
- `400`: Invalid old password, passwords don't match, or new password same as old
- `401`: Invalid/missing authentication token
- `404`: User not found

---

##  **User Management Endpoints** (Admin Only)

### 4. Get All DTUsers
```http
GET /admin/dtusers
```
**Purpose**: Get paginated list of all DTUsers with filtering (ADMIN ONLY)  
**Headers**: `Authorization: Bearer <admin_jwt_token>`  
**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Users per page (default: 20)
- `status` (optional): Filter by annotatorStatus (pending, submitted, verified, approved)
- `verified` (optional): Filter by email verification (true/false)
- `hasPassword` (optional): Filter by password status (true/false)
- `search` (optional): Search by name, email, or phone

**Example**:
```http
GET /admin/dtusers?page=1&limit=20&status=pending&search=john
Authorization: Bearer <admin_jwt_token>
```

**Response**:
```json
{
  "success": true,
  "message": "DTUsers retrieved successfully",
  "data": {
    "users": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalUsers": 100,
      "usersPerPage": 20,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "summary": {
      "totalUsers": 100,
      "statusBreakdown": {
        "pending": 20,
        "verified": 60,
        "approved": 20
      }
    }
  }
}
```

### 5. Get Single DTUser Details
```http
GET /admin/dtusers/:userId
```
**Purpose**: Get detailed information about a specific DTUser  
**Headers**: `Authorization: Bearer <jwt_token>`  
**Response**: Complete user profile with all details

### 6. Approve/Update Annotator Status
```http
PATCH /admin/dtusers/:userId/approve
```
**Purpose**: Update annotator status (approve, reject, etc.)  
**Headers**: `Authorization: Bearer <jwt_token>`  
**Request Body**:
```json
{
  "newStatus": "approved"
}
```
**Valid Statuses**: `pending`, `submitted`, `verified`, `approved`

---

## 🔐 **Two-Step Admin Creation (Advanced)**

### 7. Request Admin Verification (Step 1)
```http
POST /admin/create/request
```
**Purpose**: Start admin account creation process with email verification  
**Request Body**:
```json
{
  "fullName": "New Admin",
  "email": "newadmin@mydeeptech.ng",
  "phone": "+1234567890",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!",
  "adminKey": "super-secret-admin-key-2024"
}
```

### 8. Confirm Admin Creation (Step 2)
```http
POST /admin/create/confirm
```
**Purpose**: Complete admin account creation with verification code  
**Request Body**:
```json
{
  "email": "newadmin@mydeeptech.ng",
  "verificationCode": "123456",
  "adminKey": "super-secret-admin-key-2024"
}
```

---

## 📋 **Frontend Integration Details**

### Authentication Headers
All protected endpoints require:
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Token Storage
Store token from login response:
```javascript
// Option 1: Use _usrinfo format for consistency
sessionStorage.setItem('_usrinfo', JSON.stringify({ data: response.data.token }));

// Option 2: Use direct token
localStorage.setItem('adminToken', response.data.token);
```

### Error Handling
Common error responses:
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE", // Optional
  "error": "Technical details" // Optional
}
```

Common status codes:
- `200`: Success
- `400`: Bad Request (validation error)
- `401`: Unauthorized (invalid credentials/token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate email)
- `500`: Server Error

### Environment Variables Needed
```env
ADMIN_CREATION_KEY=your-secret-admin-key
ADMIN_EMAILS=admin1@mydeeptech.ng,admin2@mydeeptech.ng
JWT_SECRET=your-jwt-secret
```

---

## 🚀 **Usage Examples**

### Complete Admin Login Flow
```javascript
// 1. Admin Login
const loginResponse = await fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@mydeeptech.ng',
    password: 'password123'
  })
});

const { token, admin } = await loginResponse.json();

// 2. Store token
sessionStorage.setItem('_usrinfo', JSON.stringify({ data: token }));

// 3. Use token for protected requests
const usersResponse = await fetch('/api/admin/dtusers', {
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### User Management
```javascript
// Get users with pagination and filtering
const getUsers = async (page = 1, status = null, search = null) => {
  const params = new URLSearchParams({ page, limit: 20 });
  if (status) params.append('status', status);
  if (search) params.append('search', search);
  
  const response = await fetch(`/api/admin/dtusers?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return response.json();
};

// Approve annotator
const approveUser = async (userId) => {
  const response = await fetch(`/api/admin/dtusers/${userId}/approve`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newStatus: 'approved' })
  });
  
  return response.json();
};
```

---

## 🔒 **Security Notes**

1. **Domain Restriction**: Only `@mydeeptech.ng` emails can access admin endpoints
2. **Token Expiry**: JWT tokens expire in 7 days
3. **OTP Expiry**: Email OTP codes expire in 15 minutes
4. **Rate Limiting**: Consider implementing rate limiting for production
5. **HTTPS**: Use HTTPS in production for secure token transmission

---

## 📊 **Response Data Structures**

### User Object Structure
```json
{
  "id": "507f1f77bcf86cd799439011",
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "domains": ["AI", "Data Science"],
  "consent": true,
  "annotatorStatus": "approved",
  "microTaskerStatus": "pending",
  "isEmailVerified": true,
  "hasSetPassword": true,
  "resultLink": "",
  "createdAt": "2025-11-09T10:22:01.000Z",
  "updatedAt": "2025-11-09T10:22:01.000Z"
}
```

This documentation provides everything your frontend team needs to implement the admin interface! 🚀