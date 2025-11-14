# In-App Notification System API Documentation

## Overview

The In-App Notification System provides real-time notifications for users and administrators within the platform. It supports various notification types including account updates, project notifications, system alerts, and assessment results.

## Base URL
```
/api/notifications
/api/admin/notifications
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## 📥 User Notification Endpoints

### 1. Get User Notifications
Get paginated notifications for the authenticated user.

**Endpoint:** `GET /api/notifications`

**Query Parameters:**
```json
{
  "page": 1,           // Page number (default: 1)
  "limit": 10,         // Items per page (default: 10, max: 50)
  "unreadOnly": false, // Only unread notifications (default: false)
  "type": "string",    // Filter by notification type (optional)
  "priority": "string" // Filter by priority: low, medium, high (optional)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "🎉 Assessment Passed - Annotator Approved!",
        "message": "Congratulations! You scored 85% on your assessment and are now an approved annotator.",
        "type": "account_update",
        "priority": "high",
        "isRead": false,
        "actionUrl": "/projects/browse",
        "actionText": "Browse Projects",
        "relatedData": {
          "assessmentId": "507f1f77bcf86cd799439012",
          "score": 85,
          "sectionPerformance": {
            "Grammar": {"correct": 4, "total": 5, "percentage": 80},
            "Vocabulary": {"correct": 5, "total": 5, "percentage": 100}
          }
        },
        "createdAt": "2025-11-14T10:30:00.000Z",
        "readAt": null
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 25,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalNotifications": 25,
      "unreadCount": 8,
      "readCount": 17,
      "priorityBreakdown": {
        "high": 3,
        "medium": 15,
        "low": 7
      }
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "User authentication required",
  "error": "Authentication token missing or invalid"
}
```

---

### 2. Mark Notification as Read
Mark a specific notification as read.

**Endpoint:** `PATCH /api/notifications/:notificationId/read`

**URL Parameters:**
- `notificationId` (string) - The notification ID

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "notificationId": "507f1f77bcf86cd799439011",
    "isRead": true,
    "readAt": "2025-11-14T10:35:00.000Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Notification not found or access denied"
}
```

---

### 3. Mark All Notifications as Read
Mark all notifications for the user as read.

**Endpoint:** `PATCH /api/notifications/mark-all-read`

**Response:**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 8,
    "totalNotifications": 25
  }
}
```

---

### 4. Delete Notification
Delete a specific notification.

**Endpoint:** `DELETE /api/notifications/:notificationId`

**URL Parameters:**
- `notificationId` (string) - The notification ID

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

---

### 5. Get Notification Summary
Get a summary of user notifications including counts and recent activity.

**Endpoint:** `GET /api/notifications/summary`

**Response:**
```json
{
  "success": true,
  "message": "Notification summary retrieved successfully",
  "data": {
    "totalNotifications": 25,
    "unreadCount": 8,
    "readCount": 17,
    "recentCount": 3,
    "priorityBreakdown": {
      "high": 3,
      "medium": 15,
      "low": 7
    },
    "typeBreakdown": {
      "account_update": 5,
      "project_update": 12,
      "system_alert": 3,
      "assessment_result": 5
    },
    "lastNotificationTime": "2025-11-14T10:30:00.000Z"
  }
}
```

---

## 🛠 Admin Notification Endpoints

### 6. Create Notification (Admin)
Create a new notification for users.

**Endpoint:** `POST /api/admin/notifications`

**Request Body:**
```json
{
  "recipientId": "507f1f77bcf86cd799439011", // User ID (optional if recipientType is 'all')
  "recipientType": "user",                   // "user" or "all"
  "title": "System Maintenance Notice",
  "message": "Scheduled maintenance will occur on Sunday from 2-4 AM EST.",
  "type": "system_alert",                    // Required
  "priority": "medium",                      // "low", "medium", "high"
  "actionUrl": "/maintenance-info",          // Optional
  "actionText": "Learn More",               // Optional
  "relatedData": {                          // Optional
    "maintenanceStart": "2025-11-17T07:00:00.000Z",
    "maintenanceEnd": "2025-11-17T09:00:00.000Z"
  },
  "scheduleFor": "2025-11-16T18:00:00.000Z" // Optional - for scheduled notifications
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification created successfully",
  "data": {
    "notificationId": "507f1f77bcf86cd799439013",
    "recipientCount": 1,
    "isScheduled": false,
    "createdAt": "2025-11-14T10:40:00.000Z"
  }
}
```

---

### 7. Get All Notifications (Admin)
Get all notifications with filtering options for admin management.

**Endpoint:** `GET /api/admin/notifications`

**Query Parameters:**
```json
{
  "page": 1,
  "limit": 20,
  "type": "string",           // Filter by notification type
  "priority": "string",       // Filter by priority
  "recipientType": "string",  // Filter by recipient type
  "recipientId": "string",    // Filter by specific user
  "isRead": "boolean",        // Filter by read status
  "startDate": "2025-11-01",  // Filter by date range (YYYY-MM-DD)
  "endDate": "2025-11-14"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "recipientId": {
          "_id": "507f1f77bcf86cd799439011",
          "fullName": "John Doe",
          "email": "john@example.com"
        },
        "recipientType": "user",
        "title": "🎉 Assessment Passed - Annotator Approved!",
        "message": "Congratulations! You scored 85% on your assessment...",
        "type": "account_update",
        "priority": "high",
        "isRead": false,
        "createdBy": {
          "_id": "507f1f77bcf86cd799439014",
          "fullName": "System Admin"
        },
        "deliveryStatus": "delivered",
        "emailSent": true,
        "emailSentAt": "2025-11-14T10:30:05.000Z",
        "createdAt": "2025-11-14T10:30:00.000Z",
        "readAt": null
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 95,
      "hasNext": true,
      "hasPrev": false
    },
    "analytics": {
      "totalSent": 95,
      "totalRead": 67,
      "totalUnread": 28,
      "readRate": 70.5,
      "typeDistribution": {
        "account_update": 25,
        "project_update": 35,
        "system_alert": 15,
        "assessment_result": 20
      },
      "priorityDistribution": {
        "high": 20,
        "medium": 50,
        "low": 25
      }
    }
  }
}
```

---

### 8. Update Notification (Admin)
Update an existing notification.

**Endpoint:** `PUT /api/admin/notifications/:notificationId`

**URL Parameters:**
- `notificationId` (string) - The notification ID

**Request Body:**
```json
{
  "title": "Updated: System Maintenance Notice",
  "message": "Updated message content...",
  "priority": "high",
  "actionUrl": "/updated-link",
  "actionText": "Updated Action"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification updated successfully",
  "data": {
    "notificationId": "507f1f77bcf86cd799439013",
    "updatedFields": ["title", "message", "priority"],
    "updatedAt": "2025-11-14T10:45:00.000Z"
  }
}
```

---

### 9. Delete Notification (Admin)
Delete a notification (admin only).

**Endpoint:** `DELETE /api/admin/notifications/:notificationId`

**Response:**
```json
{
  "success": true,
  "message": "Notification deleted successfully by admin"
}
```

---

### 10. Broadcast Notification (Admin)
Send a notification to all users or specific user groups.

**Endpoint:** `POST /api/admin/notifications/broadcast`

**Request Body:**
```json
{
  "title": "Platform Update Announcement",
  "message": "We've released new features to improve your experience...",
  "type": "system_announcement",
  "priority": "medium",
  "targetAudience": "all",        // "all", "annotators", "micro_taskers", "verified_users"
  "actionUrl": "/whats-new",
  "actionText": "See What's New",
  "scheduleFor": "2025-11-15T09:00:00.000Z" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Broadcast notification created successfully",
  "data": {
    "broadcastId": "507f1f77bcf86cd799439015",
    "targetAudience": "all",
    "estimatedRecipients": 1247,
    "actualRecipients": 1247,
    "isScheduled": true,
    "scheduledFor": "2025-11-15T09:00:00.000Z",
    "createdAt": "2025-11-14T10:50:00.000Z"
  }
}
```

---

## 📊 Notification Analytics (Admin)

### 11. Get Notification Analytics
Get detailed analytics about notification performance.

**Endpoint:** `GET /api/admin/notifications/analytics`

**Query Parameters:**
```json
{
  "period": "7d",        // "24h", "7d", "30d", "90d", "custom"
  "startDate": "2025-11-01", // Required if period is "custom"
  "endDate": "2025-11-14",   // Required if period is "custom"
  "type": "string",      // Filter by notification type
  "priority": "string"   // Filter by priority
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification analytics retrieved successfully",
  "data": {
    "period": {
      "startDate": "2025-11-07T00:00:00.000Z",
      "endDate": "2025-11-14T23:59:59.000Z",
      "duration": "7 days"
    },
    "overview": {
      "totalSent": 156,
      "totalRead": 98,
      "totalUnread": 58,
      "readRate": 62.8,
      "averageReadTime": "2.3 hours",
      "engagementRate": 45.2
    },
    "performance": {
      "byType": [
        {
          "type": "account_update",
          "sent": 45,
          "read": 35,
          "readRate": 77.8,
          "avgReadTime": "1.2 hours"
        }
      ],
      "byPriority": [
        {
          "priority": "high",
          "sent": 25,
          "read": 22,
          "readRate": 88.0
        }
      ],
      "dailyTrend": [
        {
          "date": "2025-11-14",
          "sent": 23,
          "read": 15,
          "readRate": 65.2
        }
      ]
    },
    "userEngagement": {
      "topEngagedUsers": [
        {
          "userId": "507f1f77bcf86cd799439011",
          "fullName": "John Doe",
          "notificationsReceived": 12,
          "notificationsRead": 11,
          "readRate": 91.7
        }
      ],
      "engagementDistribution": {
        "highEngagement": 45,
        "mediumEngagement": 78,
        "lowEngagement": 33
      }
    }
  }
}
```

---

## 🔔 Notification Types

### Available Types:
- `account_update` - User account status changes
- `project_update` - Project-related notifications
- `application_update` - Application status changes
- `assessment_result` - Assessment completion notifications
- `system_alert` - System-wide alerts
- `system_announcement` - Platform announcements
- `security_alert` - Security-related notifications
- `payment_update` - Payment-related notifications

### Priority Levels:
- `low` - General information
- `medium` - Important updates
- `high` - Urgent notifications requiring attention

---

## 🔗 Related Data Structure

The `relatedData` field can contain contextual information:

```json
{
  "relatedData": {
    "assessmentId": "507f1f77bcf86cd799439012",
    "projectId": "507f1f77bcf86cd799439016",
    "applicationId": "507f1f77bcf86cd799439017",
    "score": 85,
    "sectionPerformance": {},
    "statusChange": {
      "from": "pending",
      "to": "approved"
    },
    "additionalInfo": {}
  }
}
```

---

## 📱 Real-time Updates

The notification system supports real-time updates via WebSocket connections:

```javascript
// Client-side WebSocket connection
const socket = new WebSocket('ws://localhost:3000/notifications');

socket.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // Handle new notification
  displayNotification(notification);
};
```

---

## 🚨 Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Validation Error | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Notification not found |
| 429 | Rate Limit Exceeded | Too many requests |
| 500 | Internal Server Error | Server-side error |

---

## 📋 Usage Examples

### Frontend Integration Example:

```javascript
// Fetch user notifications
const fetchNotifications = async () => {
  try {
    const response = await fetch('/api/notifications?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      displayNotifications(data.data.notifications);
      updateNotificationBadge(data.data.summary.unreadCount);
    }
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
  }
};

// Mark notification as read
const markAsRead = async (notificationId) => {
  try {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update UI to show as read
      updateNotificationStatus(notificationId, true);
    }
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
};
```

### Admin Broadcast Example:

```javascript
// Send broadcast notification
const sendBroadcast = async () => {
  const notificationData = {
    title: "🚀 New Feature Release",
    message: "We've just released exciting new annotation tools!",
    type: "system_announcement",
    priority: "medium",
    targetAudience: "annotators",
    actionUrl: "/features/new-tools",
    actionText: "Explore New Tools"
  };

  try {
    const response = await fetch('/api/admin/notifications/broadcast', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notificationData)
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`Broadcast sent to ${data.data.actualRecipients} users`);
    }
  } catch (error) {
    console.error('Failed to send broadcast:', error);
  }
};
```

This comprehensive notification system provides real-time communication capabilities for your platform, with full admin control and user engagement tracking.