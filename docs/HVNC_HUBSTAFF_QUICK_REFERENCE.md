# HVNC Hubstaff Integration - Quick Reference

## 🎯 What We're Building

**Goal**: Track actual work hours for DTUsers on HVNC devices using Hubstaff time tracking, with individual user session tracking within shared device timers.

**Key Concept**:

- One Hubstaff timer per device (shared)
- Individual work sessions per DTUser
- Real-time sync between PC Agent → Backend → Frontend

---

## 📋 Developer Quick Start

### **PC Agent Developer**

**What to monitor:**

- Hubstaff.exe process and window title
- Extract timer format: "HH:MM:SS" from window
- Track timer state: active/paused/stopped
- Get current HVNC user from session

**What to send:** (Every 30 seconds via WebSocket)

```json
{
  "deviceId": "device_123",
  "timestamp": "2026-03-16T14:30:00Z",
  "hubstaff": {
    "isRunning": true,
    "timer": {
      "isActive": true,
      "currentTime": "05:30:45",
      "totalSeconds": 19845
    }
  },
  "currentUser": {
    "userId": "dtuser_456",
    "sessionId": "hvnc_session_789"
  }
}
```

### **Frontend Developer**

**User Dashboard needs:**

- Live timer widget showing current work session
- Daily/weekly work hours summary
- Session history with device breakdown

**Admin Dashboard needs:**

- Real-time grid of active sessions across all devices
- Device utilization analytics
- User productivity reports

**Key APIs to implement:**

- `GET /api/hvnc/user/hubstaff/my-sessions` - User's time data
- `GET /api/hvnc/admin/hubstaff/active-sessions` - Live monitoring
- `GET /api/hvnc/admin/hubstaff/device-utilization/:deviceId` - Analytics

### **Backend Developer**

**Database schemas to create:**

- `HubstaffUserSessions` - Individual user work sessions
- `HubstaffDeviceTimers` - Device timer state tracking

**APIs to implement:**

- WebSocket server for real-time PC Agent updates
- HTTP endpoints for frontend data retrieval
- Session management logic for timer state changes

---

## 🔄 Example Workflow

### **Scenario: Dami works on Device-AB123**

1. **9:00 AM** - Dami connects to Device-AB123 (HVNC session starts)
2. **11:00 AM** - Dami starts Hubstaff timer (00:00:01)
   - PC Agent detects timer start
   - Backend creates new HubstaffUserSession for Dami
   - Frontend shows "🟢 Working" status
3. **2:00 PM** - Dami pauses Hubstaff timer (03:00:00)
   - PC Agent detects timer pause
   - Backend ends Dami's session (3 hours worked)
   - Frontend shows session summary
4. **3:00 PM** - Jane connects to same device, resumes timer (from 03:00:01)
   - PC Agent detects new user + timer resume
   - Backend creates new session for Jane
   - Frontend shows Jane is now active

### **Result:**

- Dami worked: 3 hours on Device-AB123
- Jane's session: Starting from 3:00 PM
- Device total timer: Continues from 3 hours
- Individual tracking: Each user's hours calculated separately

---

## 📊 Data Integration with Existing System

### **Leverages Current Infrastructure:**

- ✅ DTUser model (no changes needed)
- ✅ HVNC sessions (links to existing sessions)
- ✅ Multi-user device assignment (time slots + work tracking)
- ✅ Admin authentication (same JWT system)

### **New Additions:**

- 🆕 Hubstaff session tracking
- 🆕 Real-time timer monitoring
- 🆕 Work hours analytics
- 🆕 Productivity dashboards

---

## 🚀 Implementation Timeline

| Week  | Component | Deliverables                                 |
| ----- | --------- | -------------------------------------------- |
| **1** | PC Agent  | Hubstaff monitoring, WebSocket communication |
| **2** | Backend   | Database schemas, APIs, WebSocket server     |
| **3** | Frontend  | User dashboard, admin monitoring interface   |
| **4** | Testing   | End-to-end testing, optimization, deployment |

---

## 🔗 Complete Technical Details

📖 **Full Documentation**: [HVNC Hubstaff Integration Docs](./HVNC_HUBSTAFF_INTEGRATION_DOCS.md)

📋 **Multi-User Device Assignment**: [HVNC Multi-User Assignment API](./HVNC_MULTI_USER_ASSIGNMENT_API.md)

🛠 **Frontend Implementation**: [Frontend Implementation Checklist](./FRONTEND_IMPLEMENTATION_CHECKLIST.md)

---

## ✅ Ready to Start Development

The backend team can now implement this system that seamlessly integrates Hubstaff time tracking with the existing HVNC multi-user device assignment platform, providing accurate work hour tracking and real-time monitoring capabilities.
