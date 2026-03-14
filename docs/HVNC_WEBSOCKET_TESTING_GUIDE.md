# HVNC WebSocket Testing Guide

## 🚀 Quick Start Testing

### Prerequisites

1. HVNC backend server running on `http://localhost:4000`
2. Valid JWT tokens for authentication
3. Test device IDs (if testing device namespace)

### Testing Methods Overview

| Method                 | Best For              | Pros                               | Cons                      |
| ---------------------- | --------------------- | ---------------------------------- | ------------------------- |
| **HTML Tester**        | Quick manual testing  | Visual interface, real-time events | Manual only               |
| **Node.js Scripts**    | Automated testing     | Comprehensive, scriptable          | Requires Node.js setup    |
| **Postman Collection** | API testing           | REST endpoint validation           | Limited WebSocket support |
| **Browser Console**    | Development debugging | Built-in dev tools                 | Manual setup required     |
| **wscat**              | Command line testing  | Simple, fast                       | Basic functionality only  |

---

## 🌐 Method 1: HTML WebSocket Tester

### Setup

1. Open the HTML tester:

```bash
open hvnc-websocket-tester.html
# or serve it with a local server
python -m http.server 8080
# Then open http://localhost:8080/hvnc-websocket-tester.html
```

### Usage

1. **Configure Connection:**
   - Server URL: `http://localhost:4000`
   - JWT Token: Paste your valid JWT token
   - Namespace: Choose admin/user/device

2. **Test Scenarios:**

   ```
   Admin Testing:
   - Connect → Get Devices → Send Command

   User Testing:
   - Connect → Get Assigned Devices → Start Session

   Device Testing:
   - Connect → Send Status → Send Hubstaff Update
   ```

3. **Expected Events:**
   - ✅ Connection successful
   - 📊 Device states received
   - 🟢 Device online events
   - ⚡ Command responses

---

## 💻 Method 2: Node.js Test Scripts

### Installation

```bash
cd mydeeptech-be
npm install socket.io-client jsonwebtoken
```

### Running Tests

**Full Test Suite:**

```bash
node test/hvnc-test.js
```

**Individual Namespace Tests:**

```bash
# Test admin namespace only
node test/hvnc-test.js admin

# Test user namespace only
node test/hvnc-test.js user

# Test device namespace only
node test/hvnc-test.js device
```

### Expected Output

```
[2026-03-13T10:30:00.000Z] [TEST] Starting test: Admin Connection Test
[2026-03-13T10:30:01.000Z] [SUCCESS] ✅ Admin Connection Test - Connected to admin namespace
[2026-03-13T10:30:01.000Z] [INFO] Socket ID: abc123
[2026-03-13T10:30:03.000Z] [INFO] 📡 Testing send_command...
[2026-03-13T10:30:04.000Z] [SUCCESS] ⚡ Command sent: cmd_456789
```

---

## 📮 Method 3: Postman Collection

### Import Collection

```bash
# Import the collection file into Postman
postman/HVNC-WebSocket-Tests.postman_collection.json
```

### Testing Workflow

1. **Authentication:**
   - Run "Generate Admin Token" or "Generate User Token"
   - Token auto-saves to collection variables

2. **Device Management:**
   - Get All Devices
   - Register Test Device
   - Send Device Command

3. **Session Management:**
   - Get Active Sessions
   - Create Session
   - End Session

4. **Health Checks:**
   - Check HVNC Service Status
   - Get WebSocket Statistics

---

## 🛠️ Method 4: Manual Browser Testing

### JavaScript Console Method

```javascript
// Paste this in browser console
const socket = io("http://localhost:4000/hvnc-admin", {
  path: "/hvnc/socket.io",
  auth: { token: "YOUR_JWT_TOKEN_HERE" },
  transports: ["websocket", "polling"],
});

socket.on("connect", () => {
  console.log("✅ Connected!", socket.id);
});

socket.on("device_online", (data) => {
  console.log("🟢 Device online:", data);
});

socket.on("connect_error", (error) => {
  console.error("❌ Connection failed:", error);
});

// Test sending a command
socket.emit("send_command", {
  device_id: "test_device_123",
  type: "system",
  action: "get_status",
  parameters: {},
});
```

---

## ⚡ Method 5: Command Line with wscat

### Installation

```bash
npm install -g wscat
```

### Basic Connection Test

```bash
# Test Socket.IO handshake (will show connection established)
wscat -c "ws://localhost:4000/socket.io/?EIO=4&transport=websocket"

# With namespace (limited - Socket.IO protocol specific)
wscat -c "ws://localhost:4000/hvnc-admin/socket.io/?EIO=4&transport=websocket"
```

**Note:** wscat has limited Socket.IO support. Use for basic connectivity tests only.

---

## 🧪 Test Scenarios & Expected Results

### Admin Namespace Testing

```javascript
// Connect as admin
✅ Expected: Connection success
✅ Expected: device_states event with current devices
✅ Expected: Real-time device_online/offline events

// Send command test
✅ Expected: command_sent confirmation
✅ Expected: command_completed event when device responds
❌ Error cases: command_error if device offline
```

### User Namespace Testing

```javascript
// Connect as user
✅ Expected: Connection success with user verification
✅ Expected: assigned_devices event

// Session requests
✅ Expected: session_started when device accepts
❌ Error cases: session_error if no active shift or device offline
```

### Device Namespace Testing

```javascript
// Connect as device
✅ Expected: Connection success with device registration
✅ Expected: Device marked as 'online' in admin view
✅ Expected: status_ack when sending device_status

// Command handling
✅ Expected: command events from admin
✅ Expected: Ability to send command_result responses
```

---

## 🔐 Authentication Tokens

### Token Requirements

**Admin Token:**

```json
{
  "email": "admin@mydeeptech.ng",
  "role": "admin",
  "userId": "admin123"
}
```

**User Token:**

```json
{
  "userId": "user123",
  "email": "user@test.com",
  "fullName": "Test User"
}
```

**Device Token:**

```json
{
  "id": "device123",
  "device_id": "test_device_123",
  "type": "device"
}
```

### Generate Test Tokens

```javascript
const jwt = require("jsonwebtoken");

// Use your actual JWT_SECRET
const secret = "your_jwt_secret_here";

const adminToken = jwt.sign(
  {
    email: "admin@mydeeptech.ng",
    role: "admin",
    userId: "admin123",
  },
  secret,
  { expiresIn: "1h" },
);

console.log("Admin Token:", adminToken);
```

---

## 🚨 Troubleshooting

### Common Issues

**Connection Refused:**

- ✅ Check if backend server is running
- ✅ Verify port 4000 is accessible
- ✅ Check CORS settings include your domain

**Authentication Failed:**

- ✅ Verify JWT token is valid and not expired
- ✅ Check token contains required fields for namespace
- ✅ Ensure JWT_SECRET matches backend configuration

**No Events Received:**

- ✅ Verify correct namespace connection
- ✅ Check event listeners are set up before connection
- ✅ Confirm backend is emitting events for your test scenario

**Socket Disconnects:**

- ✅ Check network connectivity
- ✅ Verify token hasn't expired during session
- ✅ Look for authentication middleware rejections

### Debug Commands

```javascript
// Enable Socket.IO debug logs
localStorage.debug = "socket.io-client:socket";

// Check connection state
console.log("Connected:", socket.connected);
console.log("Socket ID:", socket.id);

// Monitor all events
socket.onAny((event, ...args) => {
  console.log(`Event: ${event}`, args);
});
```

---

## 📊 Success Metrics

### Connection Tests

- [ ] Admin namespace connects successfully
- [ ] User namespace connects successfully
- [ ] Device namespace connects successfully
- [ ] Authentication errors handled properly
- [ ] Disconnections logged appropriately

### Functionality Tests

- [ ] Admin can send commands to devices
- [ ] Users can request sessions
- [ ] Devices can report status updates
- [ ] Real-time events flow correctly
- [ ] Error handling works as expected

### Performance Tests

- [ ] Multiple concurrent connections supported
- [ ] Event delivery is timely (< 1 second)
- [ ] Memory usage remains stable
- [ ] No connection leaks after disconnection

---

## 🎯 Next Steps

After successful testing:

1. **Integration**: Implement in your frontend application
2. **Monitoring**: Set up WebSocket connection monitoring
3. **Error Handling**: Implement robust error recovery
4. **Scaling**: Test with multiple concurrent users
5. **Security**: Implement rate limiting and validation

For production deployment, ensure:

- HTTPS/WSS connections
- Proper CORS configuration
- Token refresh mechanisms
- Connection pool management
- Comprehensive logging
