# Admin Users Endpoint Documentation

## 📍 Endpoint: GET /api/admin/admin-users

### Description
Retrieves a list of admin users only (users with @mydeeptech.ng emails or Administration/Management domains).

### Authentication
- **Required**: Admin JWT token
- **Header**: `Authorization: Bearer <admin_token>`

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 10 | Number of results per page |
| `search` | string | - | Search term for fullName, email, or phone |
| `sortBy` | string | createdAt | Field to sort by |
| `sortOrder` | string | desc | Sort order (asc/desc) |

### Response Structure
```json
{
  "success": true,
  "message": "Retrieved X admin users",
  "data": {
    "adminUsers": [
      {
        "_id": "user_id",
        "fullName": "Admin Name",
        "email": "admin@mydeeptech.ng",
        "phone": "+1234567890",
        "domains": ["Administration", "Management"],
        "isEmailVerified": true,
        "annotatorStatus": "approved",
        "microTaskerStatus": "approved",
        "createdAt": "2025-11-09T...",
        "updatedAt": "2025-11-09T..."
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalAdminUsers": 14,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 10
    },
    "summary": {
      "totalAdminUsers": 14,
      "roleSummary": [...],
      "filters": {...}
    }
  }
}
```

### Example Requests

#### Basic request
```bash
GET /api/admin/admin-users
```

#### With pagination
```bash
GET /api/admin/admin-users?page=2&limit=5
```

#### With search
```bash
GET /api/admin/admin-users?search=Damilola
```

#### With sorting
```bash
GET /api/admin/admin-users?sortBy=fullName&sortOrder=asc
```

### Admin User Identification
Admin users are identified by:
1. **Email domain**: Must end with `@mydeeptech.ng`
2. **Domain fields**: Must contain `Administration` or `Management` in domains array

### Features
- ✅ **Pagination**: Supports page-based pagination
- ✅ **Search**: Search across fullName, email, phone fields
- ✅ **Sorting**: Sort by any field in asc/desc order
- ✅ **Filtering**: Only returns admin users, excludes regular DTUsers
- ✅ **Security**: Excludes password field from responses
- ✅ **Summary**: Provides role breakdown and statistics

### Error Responses
- **401**: Unauthorized (invalid/missing admin token)
- **500**: Server error

### Test File
Use `test-admin-users.js` to test all endpoint functionality including pagination, search, and filtering.