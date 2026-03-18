# HVNC Multi-User Assignment - Frontend Implementation Checklist

## 🚀 Quick Reference - API Endpoints

### Authentication Required

All endpoints require: `Authorization: Bearer <jwt_token>`

### User Management

```
POST   /api/hvnc/admin/users                           # Create DTUser
GET    /api/hvnc/admin/users                           # Get all DTUsers
GET    /api/hvnc/admin/users/:userId                   # Get DTUser by ID
PUT    /api/hvnc/admin/users/:userId                   # Update DTUser
DELETE /api/hvnc/admin/users/:userId                   # Delete DTUser
GET    /api/hvnc/admin/users/:userId/sessions          # Get user sessions
```

### Single User Device Assignment

```
POST   /api/hvnc/admin/users/:userId/assign-device     # Assign device to user
DELETE /api/hvnc/admin/users/:userId/remove-device/:deviceId # Remove device
```

### Multi-User Device Assignment (NEW)

```
GET    /api/hvnc/admin/devices/:deviceId/users         # Get device users
POST   /api/hvnc/admin/devices/:deviceId/assign-multiple-users # Bulk assign
GET    /api/hvnc/admin/devices/:deviceId/schedule      # Get device schedule
```

### Device Management

```
GET    /api/hvnc/admin/devices                         # Get all devices
```

---

## ✅ Frontend Implementation Checklist

### Phase 1: Core Components

- [ ] **UserManagement Component**
  - [ ] User list with pagination
  - [ ] Create/Edit user modal
  - [ ] User search and filtering
  - [ ] Delete confirmation modal

- [ ] **DeviceList Component**
  - [ ] Device grid/list view
  - [ ] Device status indicators
  - [ ] Utilization percentage display
  - [ ] Quick action buttons

### Phase 2: Single User Assignment

- [ ] **DeviceAssignment Component**
  - [ ] Time picker (start/end)
  - [ ] Day selector (checkboxes)
  - [ ] Assignment form validation
  - [ ] Success/error notifications

- [ ] **UserDeviceView Component**
  - [ ] Show user's assigned devices
  - [ ] Display time schedules
  - [ ] Remove assignment action

### Phase 3: Multi-User Assignment (Priority)

- [ ] **MultiUserAssignment Component**
  - [ ] User selection dropdown with search
  - [ ] Bulk time slot configuration
  - [ ] Conflict detection display
  - [ ] Assignment progress indicator

- [ ] **DeviceScheduleCalendar Component**
  - [ ] Weekly grid view (7 days × time slots)
  - [ ] Color-coded occupied/available slots
  - [ ] User hover tooltips
  - [ ] Week navigation controls
  - [ ] Utilization statistics

### Phase 4: Conflict Resolution

- [ ] **ConflictModal Component**
  - [ ] Display conflict details
  - [ ] Show existing user info
  - [ ] Alternative time suggestions
  - [ ] Manual time adjustment

- [ ] **BulkAssignmentResults Component**
  - [ ] Success/failure summary
  - [ ] Detailed error messages
  - [ ] Retry mechanism for failures

### Phase 5: Advanced Features

- [ ] **DeviceUtilization Dashboard**
  - [ ] Charts/graphs for device usage
  - [ ] Peak usage analytics
  - [ ] Available capacity indicators

- [ ] **UserSessionHistory Component**
  - [ ] Session timeline
  - [ ] Duration tracking
  - [ ] Activity logs

---

## 🎨 UI/UX Recommendations

### Design Patterns

**1. Device Assignment Flow:**

```
Select Device → Choose Users → Set Time Slots → Review Conflicts → Confirm
```

**2. Schedule View Options:**

- Daily view (24-hour timeline)
- Weekly view (7-day grid)
- Monthly overview
- Utilization summary

**3. Time Conflict Indicators:**

- Red: Conflicting time slots
- Yellow: Adjacent/close times (warning)
- Green: Available time slots
- Blue: Currently assigned slots

### Component Hierarchy

```
AdminDashboard/
├── UserManagement/
│   ├── UserList/
│   ├── CreateUserModal/
│   └── UserDeviceView/
├── DeviceManagement/
│   ├── DeviceList/
│   ├── DeviceScheduleCalendar/
│   └── DeviceUtilization/
└── Assignment/
    ├── SingleUserAssignment/
    ├── MultiUserAssignment/
    ├── ConflictModal/
    └── BulkAssignmentResults/
```

---

## 📱 Mobile Responsiveness

### Breakpoints

- Desktop: 1200px+
- Tablet: 768px - 1199px
- Mobile: 320px - 767px

### Mobile Optimizations

- [ ] Collapsible schedule calendar
- [ ] Swipeable time slot selection
- [ ] Bottom sheet modals
- [ ] Touch-friendly time pickers

---

## ⚡ Performance Optimization

### Lazy Loading

```javascript
// Lazy load heavy components
const DeviceScheduleCalendar = lazy(() => import("./DeviceScheduleCalendar"));
const MultiUserAssignment = lazy(() => import("./MultiUserAssignment"));
```

### Virtualization

```javascript
// For large user/device lists
import { FixedSizeList as List } from "react-window";
```

### Caching Strategy

```javascript
// Cache device schedules
const useDeviceSchedule = (deviceId, week) => {
  return useQuery(
    ["deviceSchedule", deviceId, week],
    () => fetchDeviceSchedule(deviceId, week),
    { staleTime: 5 * 60 * 1000 }, // 5 minutes
  );
};
```

---

## 🔄 State Management

### Redux Store Structure

```javascript
const store = {
  auth: { user, token, isAuthenticated },
  users: {
    list: [],
    pagination: {},
    filters: {},
    loading: false,
  },
  devices: {
    list: [],
    schedules: {},
    assignments: {},
    loading: false,
  },
  ui: {
    modals: {},
    notifications: [],
    activeView: "dashboard",
  },
};
```

### Actions

```javascript
// User Actions
createUser(userData);
updateUser(userId, updates);
deleteUser(userId);
assignDeviceToUser(userId, deviceData);

// Device Actions
fetchDevices();
fetchDeviceSchedule(deviceId, week);
assignMultipleUsers(deviceId, assignments);

// UI Actions
showModal(modalType, data);
hideModal(modalType);
addNotification(message, type);
```

---

## 🧪 Testing Strategy

### Unit Tests

- [ ] API service functions
- [ ] Time conflict detection logic
- [ ] Component rendering
- [ ] Form validations

### Integration Tests

- [ ] User assignment flow
- [ ] Conflict resolution workflow
- [ ] Bulk assignment process
- [ ] Schedule calendar navigation

### E2E Tests

- [ ] Complete user journey
- [ ] Multi-device scenarios
- [ ] Error handling flows
- [ ] Mobile responsiveness

---

## 🚀 Development Phases

### Week 1: Foundation

- Set up API services
- Create basic components
- Implement authentication

### Week 2: Core Features

- User management CRUD
- Single device assignment
- Basic schedule view

### Week 3: Multi-User Features

- Multi-user assignment
- Conflict detection
- Schedule calendar

### Week 4: Polish & Testing

- Error handling
- Performance optimization
- Testing & bug fixes

---

## 📋 Sample API Calls

### Assign Multiple Users Example

```javascript
const assignMultipleUsers = async (deviceId, assignments) => {
  try {
    const response = await api.post(
      `/hvnc/admin/devices/${deviceId}/assign-multiple-users`,
      { userAssignments: assignments },
    );

    // Handle mixed success/failure results
    const { successfulAssignments, failedAssignments } = response.data.data;

    if (failedAssignments.length > 0) {
      showConflictResolution(failedAssignments);
    }

    if (successfulAssignments.length > 0) {
      showSuccessNotification(
        `${successfulAssignments.length} users assigned successfully`,
      );
      refreshDeviceSchedule(deviceId);
    }
  } catch (error) {
    handleApiError(error);
  }
};
```

### Fetch Device Schedule Example

```javascript
const fetchDeviceSchedule = async (deviceId, weekOffset = 0) => {
  try {
    const response = await api.get(
      `/hvnc/admin/devices/${deviceId}/schedule?week=${weekOffset}&detailed=true`,
    );

    return {
      schedule: response.data.data.schedule,
      utilization: response.data.data.utilizationStats,
      availableSlots: response.data.data.availableTimeSlots,
    };
  } catch (error) {
    console.error("Failed to fetch device schedule:", error);
    throw error;
  }
};
```

This checklist provides a clear roadmap for implementing the multi-user device assignment system in the frontend application.
