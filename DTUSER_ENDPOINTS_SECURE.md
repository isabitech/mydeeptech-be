# DTUser Endpoints Summary - Corrected Security Model

## 🔐 **Security Model**

### **Admin-Only Access**
- **DTUser Management**: Only admins can view, list, and manage DTUsers
- **Domain Restriction**: Admin access limited to `@mydeeptech.ng` emails
- **Authentication**: All admin endpoints require JWT tokens with admin privileges

### **User Self-Service**  
- **Own Profile**: DTUsers can only view/edit their own profile
- **Authentication**: Users can manage their own account with user JWT tokens

---

## 📋 **Available Endpoints by Role**

### 🔑 **DTUser Self-Service Endpoints** (`/api/auth`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `POST` | `/createDTuser` | Register new DTUser account | ❌ |
| `GET` | `/verifyDTusermail/:id` | Verify email with link | ❌ |
| `POST` | `/setupPassword` | Set password after verification | ❌ |
| `POST` | `/dtUserLogin` | Login with email/password | ❌ |
| `GET` | `/dtUserProfile/:userId` | Get own profile | ✅ User |
| `PATCH` | `/dtUserProfile/:userId` | Update own profile | ✅ User |
| `PATCH` | `/dtUserResetPassword` | Reset own password | ✅ User |

### 👑 **Admin-Only Endpoints** (`/api/admin`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| `POST` | `/login` | Admin login | ❌ |
| `POST` | `/create` | Create admin account | ❌ |
| `POST` | `/verify-otp` | Verify admin email with OTP | ❌ |
| `GET` | `/dtusers` | Get all DTUsers (paginated) | ✅ Admin |
| `GET` | `/dtusers/:userId` | Get single DTUser details | ✅ Admin |
| `PATCH` | `/dtusers/:userId/approve` | Approve/update DTUser status | ✅ Admin |

---

## 🔒 **Security Features**

### **Data Privacy Protection**
```javascript
// ❌ REMOVED - No public access to DTUser lists
// GET /auth/allDTusers (removed for privacy)
// GET /auth/DTsingleuser/:id (removed for privacy)

// ✅ SECURE - Admin-only access with authentication
GET /admin/dtusers (admin token required)
GET /admin/dtusers/:userId (admin token required)
```

### **Authentication Layers**
1. **User Authentication**: DTUsers can only access their own data
2. **Admin Authentication**: Admins can access all DTUser data
3. **Domain Restriction**: Admin access limited to `@mydeeptech.ng`
4. **Token Validation**: All protected endpoints validate JWT tokens

---

## 🚀 **Frontend Implementation**

### **For DTUser Management (Admin Panel)**
```javascript
// Admin must login first
const adminLogin = async (email, password) => {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

// Get all DTUsers (admin only)
const getAllDTUsers = async (adminToken, filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/admin/dtusers?${params}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  return response.json();
};

// Approve DTUser (admin only)
const approveUser = async (adminToken, userId, newStatus) => {
  const response = await fetch(`/api/admin/dtusers/${userId}/approve`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ newStatus })
  });
  return response.json();
};
```

### **For DTUser Self-Service**
```javascript
// User login
const userLogin = async (email, password) => {
  const response = await fetch('/api/auth/dtUserLogin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

// Get own profile
const getMyProfile = async (userToken, userId) => {
  const response = await fetch(`/api/auth/dtUserProfile/${userId}`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  return response.json();
};

// Update own profile  
const updateMyProfile = async (userToken, userId, profileData) => {
  const response = await fetch(`/api/auth/dtUserProfile/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });
  return response.json();
};
```

---

## ✅ **Security Compliance**

1. **✅ Privacy Protected**: DTUser lists not publicly accessible
2. **✅ Admin Authorization**: All user management requires admin privileges  
3. **✅ Domain Restriction**: Admin access limited to company domain
4. **✅ Self-Service Only**: Users can only access their own data
5. **✅ Token Authentication**: All sensitive endpoints protected
6. **✅ Data Minimization**: Public endpoints removed to reduce exposure

---

## 📊 **Base URLs**
- **DTUser Self-Service**: `http://localhost:5000/api/auth`
- **Admin Management**: `http://localhost:5000/api/admin`

This security model ensures that:
- **DTUsers** can only manage their own accounts
- **Admins** have full user management capabilities  
- **Privacy** is maintained with no public user listings
- **Authentication** is required for all sensitive operations