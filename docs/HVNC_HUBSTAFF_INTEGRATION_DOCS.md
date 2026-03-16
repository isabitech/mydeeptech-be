# HVNC Hubstaff Time Tracking Integration - Technical Documentation

## 🎯 Overview

This document outlines the integration of Hubstaff time tracking with the existing HVNC multi-user device assignment system. The goal is to track actual work hours for DTUsers on HVNC devices using a shared Hubstaff timer per device while maintaining individual user session tracking.

---

## 📋 System Architecture

### **Core Concept**

- **One Hubstaff timer per HVNC device** (shared across all users)
- **Individual work session tracking per DTUser** within the shared timer
- **Process monitoring** on PC Agent to detect timer state changes
- **Real-time synchronization** between PC Agent and MyDeepTech backend

### **Data Flow**

```
PC Agent (monitors Hubstaff) → Backend API → Frontend Dashboards
     ↑                              ↓
HVNC Device                   Database Storage
```

---

## 🖥️ PC Agent Developer Requirements

### **1. Hubstaff Process Monitoring**

#### **Required Monitoring Capabilities**

```javascript
// Monitor Hubstaff desktop application
const hubstaffMonitoring = {
  processName: "Hubstaff.exe",
  windowTitle: true, // Extract timer from window title
  processStatus: true, // Running/stopped
  timerState: true, // Active/paused/stopped
};
```

#### **Data Extraction Methods**

```javascript
// Option B: Process monitoring implementation
class HubstaffMonitor {
  async getHubstaffStatus() {
    const process = await findProcess("Hubstaff.exe");

    if (!process) {
      return { isInstalled: false, isRunning: false };
    }

    const windowTitle = await getMainWindowTitle(process.pid);
    const timerInfo = this.parseTimerFromTitle(windowTitle);

    return {
      isInstalled: true,
      isRunning: true,
      timer: {
        isActive: timerInfo.isActive, // true/false
        currentTime: timerInfo.elapsed, // "HH:MM:SS" format
        totalSeconds: timerInfo.totalSeconds, // Integer seconds
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  // Parse timer from window title (e.g., "03:45:22 - MyDeepTech Project")
  parseTimerFromTitle(title) {
    const timerRegex = /(\d{2}):(\d{2}):(\d{2})/;
    const match = title.match(timerRegex);

    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;

      return {
        isActive: title.includes("▶") || !title.includes("⏸"), // Adjust based on Hubstaff UI
        elapsed: `${match[1]}:${match[2]}:${match[3]}`,
        totalSeconds: totalSeconds,
      };
    }

    return { isActive: false, elapsed: "00:00:00", totalSeconds: 0 };
  }
}
```

### **2. HVNC Session Integration**

#### **Current User Detection**

```javascript
// Get current HVNC user from existing session management
async getCurrentHVNCUser() {
  // This should integrate with existing HVNC session tracking
  return {
    userId: "dtuser_123",           // DTUser ID from existing system
    sessionId: "hvnc_session_456",  // Current HVNC session ID
    deviceId: "device_789",         // Device identifier
    connectedAt: "2026-03-16T09:00:00Z"
  };
}
```

### **3. Backend Communication Protocol**

#### **WebSocket Connection** (Preferred for real-time)

```javascript
// Establish WebSocket connection to backend
const ws = new WebSocket("wss://api.mydeeptech.ng/hvnc/hubstaff-sync");

// Send updates every 30 seconds
setInterval(async () => {
  const hubstaffStatus = await hubstaffMonitor.getHubstaffStatus();
  const currentUser = await getCurrentHVNCUser();

  const payload = {
    type: "HUBSTAFF_UPDATE",
    deviceId: currentUser.deviceId,
    timestamp: new Date().toISOString(),
    hubstaff: hubstaffStatus,
    currentUser: currentUser,
    agentVersion: "1.0.0",
  };

  ws.send(JSON.stringify(payload));
}, 30000);
```

#### **HTTP Fallback** (If WebSocket unavailable)

```javascript
// POST endpoint for timer updates
const postTimerUpdate = async (data) => {
  await fetch("https://api.mydeeptech.ng/api/hvnc/hubstaff/timer-update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Auth": deviceAuthToken, // Device authentication
    },
    body: JSON.stringify(data),
  });
};
```

### **4. Error Handling Requirements**

```javascript
// Handle common scenarios
const errorHandling = {
  hubstaffNotRunning: "Send status with isRunning: false",
  noHVNCUser: "Send update with currentUser: null",
  connectionLost: "Queue updates locally, retry when reconnected",
  invalidTimer: "Log error, send last known good state",
};
```

---

## 🌐 Backend API Specifications

### **1. Database Schema**

#### **HubstaffUserSessions Collection**

```javascript
const HubstaffUserSessionSchema = {
  _id: ObjectId,

  // User and Device References
  userId: {
    type: ObjectId,
    ref: "DTUser",
    required: true,
  },
  deviceId: {
    type: String, // HVNC device identifier
    required: true,
  },
  hvncSessionId: {
    type: ObjectId,
    ref: "HVNCSession",
    required: true,
  },

  // Session Timing
  date: {
    type: String, // YYYY-MM-DD format
    required: true,
    index: true,
  },
  sessionStartTime: {
    type: Date,
    required: true,
  },
  sessionEndTime: {
    type: Date,
    default: null, // null while session is active
  },

  // Hubstaff Timer Context
  hubstaffStartOffset: {
    type: Number, // Seconds - timer value when user started
    required: true,
  },
  hubstaffEndOffset: {
    type: Number, // Seconds - timer value when user stopped
    default: null,
  },

  // Calculated Work Time
  userWorkedSeconds: {
    type: Number,
    default: 0,
  },
  userWorkedHours: {
    type: Number,
    default: 0,
  },

  // Session Status
  isActive: {
    type: Boolean,
    default: true,
  },
  endReason: {
    type: String,
    enum: [
      "user_paused",
      "user_stopped",
      "hvnc_disconnected",
      "timer_stopped",
      "device_timeout",
    ],
    default: null,
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
};

// Compound indexes for efficient queries
HubstaffUserSessionSchema.index({ userId: 1, date: 1 });
HubstaffUserSessionSchema.index({ deviceId: 1, date: 1 });
HubstaffUserSessionSchema.index({ isActive: 1, deviceId: 1 });
```

#### **HubstaffDeviceTimers Collection** (Tracking device timer state)

```javascript
const HubstaffDeviceTimerSchema = {
  _id: ObjectId,
  deviceId: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },

  // Current Timer State
  isActive: {
    type: Boolean,
    default: false,
  },
  totalElapsedSeconds: {
    type: Number,
    default: 0,
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now,
  },

  // Daily Reset Tracking
  timerResetAt: {
    type: Date, // When timer was reset to 00:00:00
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
};

HubstaffDeviceTimerSchema.index({ deviceId: 1, date: 1 }, { unique: true });
```

### **2. API Endpoints**

#### **WebSocket Endpoint**

```javascript
// WebSocket connection: wss://api.mydeeptech.ng/hvnc/hubstaff-sync
// Handles real-time timer updates from PC Agents

const handleHubstaffUpdate = async (data) => {
  const { deviceId, hubstaff, currentUser, timestamp } = data;

  // Process timer state change
  await hubstaffService.processTimerUpdate({
    deviceId,
    hubstaffState: hubstaff,
    currentUser,
    timestamp,
  });
};
```

#### **HTTP Timer Update Endpoint**

```javascript
// POST /api/hvnc/hubstaff/timer-update
{
  "deviceId": "device_789",
  "timestamp": "2026-03-16T14:30:00Z",
  "hubstaff": {
    "isInstalled": true,
    "isRunning": true,
    "timer": {
      "isActive": true,
      "currentTime": "05:30:45",
      "totalSeconds": 19845,
      "lastUpdated": "2026-03-16T14:30:00Z"
    }
  },
  "currentUser": {
    "userId": "dtuser_123",
    "sessionId": "hvnc_session_456",
    "deviceId": "device_789",
    "connectedAt": "2026-03-16T14:00:00Z"
  }
}
```

#### **Admin Dashboard Endpoints**

```javascript
// GET /api/hvnc/admin/hubstaff/active-sessions
// Returns all currently active Hubstaff sessions across devices
{
  "success": true,
  "data": [
    {
      "deviceId": "device_789",
      "deviceName": "HVNC-001",
      "currentUser": {
        "userId": "dtuser_123",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "session": {
        "sessionId": "session_456",
        "startTime": "2026-03-16T14:00:00Z",
        "currentDuration": "0:30:45",
        "isActive": true
      },
      "hubstaffTimer": {
        "totalElapsed": "5:30:45",
        "isActive": true
      }
    }
  ]
}
```

```javascript
// GET /api/hvnc/admin/hubstaff/user-sessions/:userId
// Get user's Hubstaff session history
Query Parameters:
- startDate: YYYY-MM-DD (optional)
- endDate: YYYY-MM-DD (optional)
- page: number (optional, default: 1)
- limit: number (optional, default: 20)

Response:
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "session_123",
        "date": "2026-03-16",
        "deviceId": "device_789",
        "deviceName": "HVNC-001",
        "startTime": "14:00:00",
        "endTime": "17:30:00",
        "workedHours": 3.5,
        "workedMinutes": 210,
        "endReason": "user_paused"
      }
    ],
    "totalSessions": 25,
    "totalHoursWorked": 187.5,
    "averageSessionHours": 7.5,
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "hasNextPage": true
    }
  }
}
```

```javascript
// GET /api/hvnc/admin/hubstaff/device-utilization/:deviceId
// Get device Hubstaff utilization stats
{
  "success": true,
  "data": {
    "deviceId": "device_789",
    "deviceName": "HVNC-001",
    "today": {
      "date": "2026-03-16",
      "totalHubstaffHours": 8.5,
      "activeUsers": 3,
      "sessions": [
        {
          "userId": "dtuser_123",
          "userName": "John Doe",
          "startTime": "09:00",
          "endTime": "12:30",
          "workedHours": 3.5
        }
      ]
    },
    "weekSummary": {
      "totalHours": 42.5,
      "averageDailyHours": 8.5,
      "mostActiveDay": "Wednesday",
      "utilizationRate": 85.4 // Percentage of scheduled time actually worked
    }
  }
}
```

```javascript
// GET /api/hvnc/admin/hubstaff/monthly-tracking/:year/:month
// Get monthly DTUser tracking with Hubstaff hours and device assignments
{
  "success": true,
  "data": {
    "month": "2026-03",
    "dateRange": {
      "startDate": "2026-03-01",
      "endDate": "2026-03-31"
    },
    "totalUsers": 5,
    "users": [
      {
        "userId": "user123",
        "userDetails": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com",
          "phoneNumber": "1234567890",
          "isActive": true
        },
        "workingStats": {
          "totalHoursWorked": 158.5,
          "totalSessions": 23,
          "devicesUsed": ["device_789", "device_456"],
          "totalMinutesWorked": 9510,
          "averageHoursPerSession": 6.89,
          "firstWorkDate": "2026-03-01",
          "lastWorkDate": "2026-03-15"
        },
        "deviceAssignments": [
          {
            "deviceId": "device_789",
            "startTime": "09:00",
            "endTime": "17:00",
            "assignedDays": [1, 2, 3, 4, 5],
            "isActive": true,
            "status": "active"
          }
        ],
        "assignmentStatus": {
          "hasActiveAssignments": true,
          "totalDevicesAssigned": 1,
          "currentDevices": ["device_789"],
          "pastDevices": ["device_456"]
        }
      }
    ],
    "summary": {
      "totalUsersWithHours": 8,
      "totalUsersWithDeviceAssignments": 5,
      "totalHoursWorked": 567.25,
      "averageHoursPerUser": 113.45,
      "totalDevicesUsed": 4,
      "activeUsers": 5
    }
  }
}
```

#### **User Dashboard Endpoints**

```javascript
// GET /api/hvnc/user/hubstaff/my-sessions
// Get current user's Hubstaff sessions
Headers: { Authorization: "Bearer <dtuser_jwt_token>" }

{
  "success": true,
  "data": {
    "currentSession": {
      "isActive": true,
      "deviceId": "device_789",
      "deviceName": "HVNC-001",
      "startTime": "14:00:00",
      "currentDuration": "2:15:30",
      "hubstaffTimer": "6:45:30"
    },
    "todayTotal": {
      "date": "2026-03-16",
      "totalWorkedHours": 6.25,
      "sessionsCount": 2,
      "devices": ["HVNC-001"]
    },
    "weekSummary": {
      "totalHours": 35.5,
      "dailyBreakdown": [
        { "date": "Mon", "hours": 8.0 },
        { "date": "Tue", "hours": 7.5 },
        { "date": "Wed", "hours": 8.5 },
        { "date": "Thu", "hours": 6.5 },
        { "date": "Fri": "hours": 5.0 }
      ]
    }
  }
}
```

---

## 💻 Frontend Developer Requirements

### **1. User Dashboard Components**

#### **Live Timer Widget Component**

```jsx
const LiveTimerWidget = () => {
  const [currentSession, setCurrentSession] = useState(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket("wss://api.mydeeptech.ng/user/hubstaff-updates");

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === "SESSION_UPDATE") {
        setCurrentSession(update.session);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="timer-widget">
      {currentSession?.isActive ? (
        <div>
          <h3>🟢 Working on {currentSession.deviceName}</h3>
          <div className="timer-display">
            <span className="user-time">{currentSession.currentDuration}</span>
            <span className="hubstaff-time">
              Hubstaff: {currentSession.hubstaffTimer}
            </span>
          </div>
          <p>Started at {currentSession.startTime}</p>
        </div>
      ) : (
        <div>
          <h3>⏸️ Not currently working</h3>
          <p>
            Connect to an HVNC device and start Hubstaff timer to begin tracking
          </p>
        </div>
      )}
    </div>
  );
};
```

#### **Daily/Weekly Summary Component**

```jsx
const WorkTimeSummary = () => {
  const [timeData, setTimeData] = useState(null);

  useEffect(() => {
    fetch("/api/hvnc/user/hubstaff/my-sessions", {
      headers: { Authorization: `Bearer ${getUserToken()}` },
    })
      .then((res) => res.json())
      .then((data) => setTimeData(data.data));
  }, []);

  return (
    <div className="work-summary">
      <div className="today-summary">
        <h3>Today: {timeData?.todayTotal.totalWorkedHours}h</h3>
        <p>{timeData?.todayTotal.sessionsCount} sessions</p>
      </div>

      <div className="week-chart">
        {timeData?.weekSummary.dailyBreakdown.map((day) => (
          <div key={day.date} className="day-bar">
            <div className="bar" style={{ height: `${day.hours * 10}px` }} />
            <span>{day.date}</span>
            <span>{day.hours}h</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **2. Admin Dashboard Components**

#### **Real-time Device Monitoring Component**

```jsx
const RealTimeDeviceMonitor = () => {
  const [activeSessions, setActiveSessions] = useState([]);

  useEffect(() => {
    // Poll every 30 seconds for active sessions
    const interval = setInterval(() => {
      fetch("/api/hvnc/admin/hubstaff/active-sessions", {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      })
        .then((res) => res.json())
        .then((data) => setActiveSessions(data.data));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="device-monitor">
      <h2>Active Hubstaff Sessions ({activeSessions.length})</h2>

      <div className="sessions-grid">
        {activeSessions.map((session) => (
          <div key={session.deviceId} className="session-card">
            <h3>{session.deviceName}</h3>
            <div className="user-info">
              <strong>
                {session.currentUser.firstName} {session.currentUser.lastName}
              </strong>
              <span>{session.currentUser.email}</span>
            </div>
            <div className="timing-info">
              <div>User Session: {session.session.currentDuration}</div>
              <div>Hubstaff Total: {session.hubstaffTimer.totalElapsed}</div>
              <div>
                Started:{" "}
                {new Date(session.session.startTime).toLocaleTimeString()}
              </div>
            </div>
            <div
              className={`status ${session.session.isActive ? "active" : "inactive"}`}
            >
              {session.session.isActive ? "🟢 Active" : "🔴 Inactive"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### **Device Utilization Analytics Component**

```jsx
const DeviceUtilizationAnalytics = ({ deviceId }) => {
  const [utilizationData, setUtilizationData] = useState(null);

  useEffect(() => {
    fetch(`/api/hvnc/admin/hubstaff/device-utilization/${deviceId}`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
      .then((res) => res.json())
      .then((data) => setUtilizationData(data.data));
  }, [deviceId]);

  return (
    <div className="utilization-analytics">
      <h3>{utilizationData?.deviceName} Utilization</h3>

      <div className="today-stats">
        <div>Today: {utilizationData?.today.totalHubstaffHours}h</div>
        <div>Active Users: {utilizationData?.today.activeUsers}</div>
        <div>
          Utilization Rate: {utilizationData?.weekSummary.utilizationRate}%
        </div>
      </div>

      <div className="sessions-timeline">
        {utilizationData?.today.sessions.map((session, index) => (
          <div key={index} className="session-bar">
            <span className="user-name">{session.userName}</span>
            <span className="time-range">
              {session.startTime} - {session.endTime}
            </span>
            <span className="duration">{session.workedHours}h</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### **3. WebSocket Integration for Real-time Updates**

```javascript
// Real-time updates service
class HubstaffRealtimeService {
  constructor(userToken, isAdmin = false) {
    this.userToken = userToken;
    this.isAdmin = isAdmin;
    this.subscribers = [];
  }

  connect() {
    const endpoint = this.isAdmin
      ? "wss://api.mydeeptech.ng/admin/hubstaff-updates"
      : "wss://api.mydeeptech.ng/user/hubstaff-updates";

    this.ws = new WebSocket(endpoint, [], {
      headers: { Authorization: `Bearer ${this.userToken}` },
    });

    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.notifySubscribers(update);
    };
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  notifySubscribers(update) {
    this.subscribers.forEach((callback) => callback(update));
  }
}
```

---

## 🔄 Integration Points with Existing System

### **1. DTUser Model Integration**

- Hubstaff sessions link to existing `DTUser._id`
- No changes needed to DTUser model
- Use existing DTUser authentication

### **2. HVNC Session Integration**

- Link Hubstaff sessions to existing `HVNCSession._id`
- Leverage existing session management for user detection
- Integrate with current device assignment system

### **3. Device Management Integration**

- Use existing device identifiers
- Extend device status to include Hubstaff timer state
- Integrate with multi-user device assignment

---

## 🚀 Implementation Phases

### **Phase 1: PC Agent Development (Week 1)**

- Hubstaff process monitoring
- WebSocket communication to backend
- Error handling and reconnection logic

### **Phase 2: Backend API Development (Week 2)**

- Database schema implementation
- WebSocket server for real-time updates
- HTTP API endpoints for CRUD operations
- Integration with existing DTUser/HVNC systems

### **Phase 3: Frontend Development (Week 3)**

- User dashboard timer widget
- Admin real-time monitoring interface
- Historical reporting components

### **Phase 4: Testing & Optimization (Week 4)**

- End-to-end testing
- Performance optimization
- Error handling refinement
- Production deployment

---

## 🔒 Security Considerations

### **Device Authentication**

- PC Agent requires device-specific auth token
- Prevent unauthorized timer updates

### **User Privacy**

- Only track timer data, not screen content
- Respect user privacy settings
- Secure WebSocket connections

### **Admin Access Control**

- Admin endpoints require proper JWT verification
- Role-based access to sensitive data

---

This comprehensive documentation should provide clear guidance for both PC Agent and Frontend developers to implement the Hubstaff integration seamlessly with the existing HVNC/DTUser system.
