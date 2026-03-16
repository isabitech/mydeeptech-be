# HVNC Multi-User Device Assignment API Documentation

## Overview

This document describes the enhanced HVNC system API that supports multiple users being assigned to a single device with time-slot management, conflict detection, and comprehensive scheduling capabilities.

## Authentication

All admin endpoints require JWT authentication with `@mydeeptech.ng` email domain and admin role.

**Headers Required:**

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 1. Enhanced User Management

### 1.1 Create DTUser

**Endpoint:** `POST /api/hvnc/admin/users`

**Request Body:**

```json
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "1234567890",
  "role": "user",
  "isActive": true,
  "metadata": {
    "department": "Engineering",
    "position": "Developer"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "DTUser created successfully",
  "data": {
    "_id": "user123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "1234567890",
    "role": "user",
    "isActive": true,
    "metadata": {
      "department": "Engineering",
      "position": "Developer"
    },
    "createdAt": "2026-03-16T10:00:00.000Z",
    "updatedAt": "2026-03-16T10:00:00.000Z"
  }
}
```

### 1.2 Get All DTUsers

**Endpoint:** `GET /api/hvnc/admin/users`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by email, firstName, or lastName
- `role` (optional): Filter by role
- `isActive` (optional): Filter by active status

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [...],
    "totalUsers": 25,
    "totalPages": 3,
    "currentPage": 1,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 1.3 Get DTUser by ID

**Endpoint:** `GET /api/hvnc/admin/users/:userId`

### 1.4 Update DTUser

**Endpoint:** `PUT /api/hvnc/admin/users/:userId`

### 1.5 Delete DTUser

**Endpoint:** `DELETE /api/hvnc/admin/users/:userId`

### 1.6 Get User Session History

**Endpoint:** `GET /api/hvnc/admin/users/:userId/sessions`

---

## 2. Single User Device Assignment

### 2.1 Assign Device to User

**Endpoint:** `POST /api/hvnc/admin/users/:userId/assign-device`

**Request Body:**

```json
{
  "deviceId": "device123",
  "startTime": "09:00",
  "endTime": "17:00",
  "assignedDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Device assigned to user successfully",
  "data": {
    "shiftId": "shift123",
    "userId": "user123",
    "deviceId": "device123",
    "startTime": "09:00",
    "endTime": "17:00",
    "assignedDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "isActive": true,
    "createdAt": "2026-03-16T10:00:00.000Z"
  }
}
```

**Error Response (Time Conflict):**

```json
{
  "success": false,
  "message": "Time slot conflict detected",
  "error": {
    "type": "TIME_CONFLICT",
    "conflicts": [
      {
        "day": "Monday",
        "conflictStart": "09:00",
        "conflictEnd": "12:00",
        "existingUser": {
          "name": "Jane Smith",
          "email": "jane@example.com",
          "timeSlot": "08:00-12:00"
        }
      }
    ]
  }
}
```

### 2.2 Remove Device from User

**Endpoint:** `DELETE /api/hvnc/admin/users/:userId/remove-device/:deviceId`

---

## 3. Multi-User Device Assignment

### 3.1 Get All Users Assigned to Device

**Endpoint:** `GET /api/hvnc/admin/devices/:deviceId/users`

**Response:**

```json
{
  "success": true,
  "data": {
    "deviceId": "device123",
    "deviceName": "HVNC-001",
    "assignedUsers": [
      {
        "userId": "user1",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "shiftDetails": {
          "shiftId": "shift1",
          "startTime": "09:00",
          "endTime": "13:00",
          "assignedDays": ["Monday", "Wednesday", "Friday"],
          "isActive": true
        }
      },
      {
        "userId": "user2",
        "email": "jane@example.com",
        "firstName": "Jane",
        "lastName": "Smith",
        "shiftDetails": {
          "shiftId": "shift2",
          "startTime": "14:00",
          "endTime": "18:00",
          "assignedDays": ["Tuesday", "Thursday"],
          "isActive": true
        }
      }
    ],
    "totalAssignedUsers": 2
  }
}
```

### 3.2 Assign Multiple Users to Device

**Endpoint:** `POST /api/hvnc/admin/devices/:deviceId/assign-multiple-users`

**Request Body:**

```json
{
  "userAssignments": [
    {
      "userId": "user1",
      "startTime": "09:00",
      "endTime": "12:00",
      "assignedDays": ["Monday", "Wednesday", "Friday"]
    },
    {
      "userId": "user2",
      "startTime": "13:00",
      "endTime": "17:00",
      "assignedDays": ["Tuesday", "Thursday"]
    },
    {
      "userId": "user3",
      "startTime": "18:00",
      "endTime": "22:00",
      "assignedDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Multiple users assigned to device successfully",
  "data": {
    "deviceId": "device123",
    "successfulAssignments": [
      {
        "userId": "user1",
        "shiftId": "shift1",
        "message": "User assigned successfully"
      },
      {
        "userId": "user2",
        "shiftId": "shift2",
        "message": "User assigned successfully"
      }
    ],
    "failedAssignments": [
      {
        "userId": "user3",
        "error": "Time slot conflict detected",
        "conflicts": [
          {
            "day": "Monday",
            "conflictStart": "18:00",
            "conflictEnd": "22:00",
            "existingUser": {
              "name": "John Doe",
              "email": "john@example.com",
              "timeSlot": "20:00-23:00"
            }
          }
        ]
      }
    ],
    "totalSuccessful": 2,
    "totalFailed": 1
  }
}
```

### 3.3 Get Device Schedule

**Endpoint:** `GET /api/hvnc/admin/devices/:deviceId/schedule`

**Query Parameters:**

- `week` (optional): Week offset from current week (default: 0)
- `detailed` (optional): Include detailed assignment info (default: false)

**Response:**

```json
{
  "success": true,
  "data": {
    "deviceId": "device123",
    "deviceName": "HVNC-001",
    "weekInfo": {
      "startDate": "2026-03-16",
      "endDate": "2026-03-22",
      "weekNumber": 11
    },
    "schedule": {
      "Monday": [
        {
          "timeSlot": "09:00-13:00",
          "userId": "user1",
          "userName": "John Doe",
          "userEmail": "john@example.com",
          "shiftId": "shift1",
          "status": "active"
        },
        {
          "timeSlot": "14:00-18:00",
          "userId": "user3",
          "userName": "Alice Johnson",
          "userEmail": "alice@example.com",
          "shiftId": "shift3",
          "status": "active"
        }
      ],
      "Tuesday": [
        {
          "timeSlot": "10:00-14:00",
          "userId": "user2",
          "userName": "Jane Smith",
          "userEmail": "jane@example.com",
          "shiftId": "shift2",
          "status": "active"
        }
      ],
      "Wednesday": [...],
      "Thursday": [...],
      "Friday": [...],
      "Saturday": [],
      "Sunday": []
    },
    "utilizationStats": {
      "totalHoursScheduled": 32,
      "totalHoursAvailable": 168,
      "utilizationPercentage": 19.05,
      "busyDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "availableDays": ["Saturday", "Sunday"],
      "peakUsageDay": "Monday",
      "peakUsageHours": 8
    },
    "availableTimeSlots": [
      {
        "day": "Monday",
        "availableSlots": ["06:00-09:00", "13:00-14:00", "18:00-23:59"]
      },
      {
        "day": "Saturday",
        "availableSlots": ["00:00-23:59"]
      },
      {
        "day": "Sunday",
        "availableSlots": ["00:00-23:59"]
      }
    ]
  }
}
```

---

## 4. Device Management

### 4.1 Get All HVNC Devices

**Endpoint:** `GET /api/hvnc/admin/devices`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "device123",
      "deviceName": "HVNC-001",
      "ipAddress": "192.168.1.100",
      "port": 5900,
      "status": "online",
      "assignedUsersCount": 3,
      "currentUtilization": 45.2,
      "lastActivity": "2026-03-16T09:30:00.000Z"
    }
  ]
}
```

---

## 5. Frontend Implementation Guidelines

### 5.1 Device Assignment UI Components

#### Multi-User Assignment Interface

```jsx
// Component for assigning multiple users to a device
<MultiUserAssignment
  deviceId={deviceId}
  onAssignmentSuccess={handleSuccess}
  onAssignmentError={handleError}
/>
```

**Required Features:**

- User selection dropdown with search
- Time picker for start/end times
- Day selector (checkboxes for each day)
- Conflict validation before submission
- Bulk assignment capability

#### Device Schedule Calendar

```jsx
// Weekly calendar view showing device schedule
<DeviceScheduleCalendar
  deviceId={deviceId}
  week={currentWeek}
  onTimeSlotClick={handleTimeSlotClick}
  showUtilization={true}
/>
```

**Required Features:**

- Weekly grid view (7 days × 24 hours)
- Color-coded time slots (busy/available)
- User hover details
- Utilization percentage display
- Navigation between weeks

### 5.2 Conflict Resolution Flow

1. **Time Conflict Detection:**
   - Show conflict details in modal/popup
   - Display existing user information
   - Provide alternative time suggestions
   - Allow manual time adjustment

2. **Bulk Assignment Results:**
   - Show summary of successful/failed assignments
   - Display detailed conflict information for failures
   - Provide retry mechanism for failed assignments

### 5.3 Error Handling

```javascript
// Example error handling for time conflicts
const handleAssignmentError = (error) => {
  if (error.type === "TIME_CONFLICT") {
    showConflictModal({
      conflicts: error.conflicts,
      onResolve: handleConflictResolution,
    });
  } else {
    showGenericErrorMessage(error.message);
  }
};
```

### 5.4 State Management Recommendations

```javascript
// Redux/Context state structure
const hvncState = {
  devices: [],
  users: [],
  assignments: {},
  schedules: {},
  conflicts: [],
  loading: {
    devices: false,
    assignments: false,
    schedule: false,
  },
};
```

### 5.5 Real-time Updates

Consider implementing WebSocket connections for:

- Device status changes
- Assignment updates
- Schedule conflicts
- User session start/end

---

## 6. Testing Scenarios

### 6.1 Time Conflict Testing

- Assign overlapping time slots
- Test boundary conditions (adjacent times)
- Test cross-day assignments
- Test bulk assignment conflicts

### 6.2 Schedule Visualization Testing

- Empty device schedules
- Fully booked devices
- Partial week assignments
- Different time zones

### 6.3 User Experience Testing

- Large user lists (pagination)
- Multiple device management
- Conflict resolution workflows
- Mobile responsiveness

---

## 7. Performance Considerations

### 7.1 API Optimization

- Use pagination for large datasets
- Implement search/filtering on server side
- Cache device schedules for frequently accessed devices
- Use efficient date/time querying

### 7.2 Frontend Optimization

- Virtualize large user lists
- Lazy load device schedules
- Debounce search inputs
- Optimize calendar rendering

---

## 8. Security Notes

- All endpoints require admin authentication
- Validate time formats on both client and server
- Sanitize user inputs
- Implement rate limiting for bulk operations
- Log all assignment changes for audit trail

---

This documentation provides comprehensive coverage of the new multi-user device assignment system. The frontend team should implement these endpoints with proper error handling, user experience considerations, and real-time updates where applicable.
