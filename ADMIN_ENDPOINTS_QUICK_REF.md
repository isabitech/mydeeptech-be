# Admin API Endpoints - Quick Reference

## 🔐 Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/admin/login` | Login with email/password |
| `POST` | `/admin/create` | Create admin account |
| `POST` | `/admin/verify-otp` | Verify email with OTP |

## � DTUser Account Management
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `PATCH` | `/auth/dtUserResetPassword` | Reset user password | ✅ |

## �👥 User Management  
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `GET` | `/admin/dtusers` | Get all users (paginated) | ✅ |
| `GET` | `/admin/dtusers/:userId` | Get single user details | ✅ |
| `PATCH` | `/admin/dtusers/:userId/approve` | Approve/update user status | ✅ |

## 📋 Request Examples

### Login
```bash
POST /api/admin/login
{
  "email": "admin@mydeeptech.ng", 
  "password": "YourPassword123!"
}
```

### Get Users with Filters
```bash
GET /api/admin/dtusers?page=1&limit=20&status=pending&search=john
Authorization: Bearer <jwt_token>
```

### Approve User
```bash
PATCH /api/admin/dtusers/507f1f77bcf86cd799439011/approve
Authorization: Bearer <jwt_token>
{
  "newStatus": "approved"
}
```

### Reset DTUser Password
```bash
PATCH /api/auth/dtUserResetPassword
Authorization: Bearer <jwt_token>
{
  "oldPassword": "CurrentPass123!",
  "newPassword": "NewPass123!", 
  "confirmNewPassword": "NewPass123!"
}
```

## 🔑 Authentication Headers
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## 📊 Key Response Fields

### Login Response
- `token` - JWT token for API calls
- `_usrinfo.data` - Token in frontend-compatible format  
- `admin` - Complete admin profile

### Users List Response
- `users` - Array of user objects
- `pagination` - Page info (currentPage, totalPages, etc.)
- `summary` - Statistics (totalUsers, statusBreakdown)

## ⚙️ Environment Requirements
- `ADMIN_CREATION_KEY` - Secret key for admin creation
- `JWT_SECRET` - Secret for JWT token signing
- Email domain restriction: `@mydeeptech.ng` only

## 🚨 Status Codes
- `200` - Success
- `401` - Invalid credentials/token  
- `403` - Insufficient permissions
- `404` - Resource not found
- `409` - Duplicate email

---
**Base URL**: `http://localhost:5000/api/admin`  
**Full Documentation**: See `ADMIN_API_DOCUMENTATION.md`