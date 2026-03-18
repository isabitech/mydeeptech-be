# PC Agent Developer - HVNC Hubstaff Integration Guide

## 🎯 Your Mission

You'll build the **PC Agent component** that monitors Hubstaff desktop application and syncs timer data with the MyDeepTech backend in real-time.

### **Core Responsibilities:**

1. **Monitor Hubstaff Process** - Detect when Hubstaff is running and extract timer data
2. **Track HVNC Users** - Know which DTUser is currently connected to the device
3. **Real-time Sync** - Send timer updates to backend every 30 seconds
4. **Handle Offline Mode** - Queue updates when connection is lost

---

## 🖥️ System Architecture

```
Remote PC with HVNC Device
├── Hubstaff Desktop App (timer running)
├── Your PC Agent (monitoring + sync)
└── HVNC Session (current user)
     ↓ (WebSocket/HTTP)
MyDeepTech Backend
```

### **Data Flow:**

```
1. PC Agent detects Hubstaff timer: "03:45:22"
2. PC Agent checks current HVNC user: "dtuser_123"
3. PC Agent sends update to backend every 30 seconds
4. Backend processes - creates/updates user sessions
5. Frontend shows live timer data to users/admins
```

---

## 📋 Technical Requirements

### **1. Hubstaff Process Monitoring (Option B)**

#### **Monitor Target Process:**

```
Process Name: Hubstaff.exe
Window Title Examples:
- "03:45:22 - MyDeepTech Project - Hubstaff"
- "⏸️ 02:30:15 - Development Task - Hubstaff"
- "▶️ 01:15:45 - Client Work - Hubstaff"
```

#### **Implementation Strategy:**

```javascript
// Node.js example using node-process-list
const processList = require("node-process-list");
const { getWindowText } = require("node-win32-window");

class HubstaffMonitor {
  async getHubstaffStatus() {
    try {
      // Find Hubstaff process
      const processes = await processList.snapshot("pid", "name");
      const hubstaffProcess = processes.find((p) =>
        p.name.toLowerCase().includes("hubstaff"),
      );

      if (!hubstaffProcess) {
        return {
          isInstalled: false,
          isRunning: false,
        };
      }

      // Get window title to extract timer
      const windowTitle = await this.getMainWindowTitle(hubstaffProcess.pid);
      const timerInfo = this.parseTimerFromTitle(windowTitle);

      return {
        isInstalled: true,
        isRunning: true,
        timer: {
          isActive: timerInfo.isActive,
          currentTime: timerInfo.elapsed,
          totalSeconds: timerInfo.totalSeconds,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Error monitoring Hubstaff:", error);
      return {
        isInstalled: false,
        isRunning: false,
        error: error.message,
      };
    }
  }

  parseTimerFromTitle(title) {
    // Extract timer from formats like:
    // "03:45:22 - Project Name" or "⏸️ 02:30:15 - Task"
    const timerRegex = /(\d{2}):(\d{2}):(\d{2})/;
    const match = title.match(timerRegex);

    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;

      // Check for pause indicators in title
      const isPaused = title.includes("⏸️") || title.includes("paused");

      return {
        isActive: !isPaused,
        elapsed: `${match[1]}:${match[2]}:${match[3]}`,
        totalSeconds: totalSeconds,
      };
    }

    return {
      isActive: false,
      elapsed: "00:00:00",
      totalSeconds: 0,
    };
  }
}
```

#### **Alternative Approaches:**

```javascript
// Option 1: Windows Registry monitoring
const Registry = require("winreg");
const hubstaffKey = new Registry({
  hive: Registry.HKCU,
  key: "\\Software\\Hubstaff",
});

// Option 2: File system monitoring
const fs = require("fs");
const hubstaffDataPath = "C:\\Users\\{User}\\AppData\\Local\\Hubstaff\\";

// Option 3: Process memory reading (advanced)
const processMemory = require("node-process-memory");
```

### **2. HVNC User Detection**

#### **Integration with Existing HVNC System:**

```javascript
class HVNCUserDetector {
  async getCurrentUser() {
    try {
      // This should integrate with your existing HVNC session management
      // The implementation depends on how HVNC sessions are currently tracked

      // Method 1: Read from session file/registry
      const sessionData = await this.readSessionData();

      // Method 2: API call to local HVNC service
      const sessionInfo = await this.getSessionFromHVNCService();

      // Method 3: Environment variable or config file
      const userInfo = await this.getUserFromConfig();

      if (sessionData && sessionData.userId) {
        return {
          userId: sessionData.userId, // DTUser ID
          sessionId: sessionData.sessionId, // HVNC session ID
          deviceId: sessionData.deviceId, // Device identifier
          connectedAt: sessionData.connectedAt,
        };
      }

      return null; // No user currently connected
    } catch (error) {
      console.error("Error detecting HVNC user:", error);
      return null;
    }
  }

  async readSessionData() {
    // Example: Read from HVNC session file
    try {
      const sessionFile = "C:\\HVNC\\current_session.json";
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
      return sessionData;
    } catch (error) {
      return null;
    }
  }
}
```

### **3. Backend Communication Protocol**

#### **WebSocket Connection (Recommended):**

```javascript
const WebSocket = require("ws");

class BackendSync {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.deviceId = this.getDeviceId(); // Unique device identifier
    this.offlineQueue = [];
  }

  connect() {
    try {
      this.ws = new WebSocket("wss://api.mydeeptech.ng/hvnc/hubstaff-sync");

      this.ws.on("open", () => {
        console.log("Connected to MyDeepTech backend");
        this.reconnectAttempts = 0;

        // Send authentication
        this.ws.send(
          JSON.stringify({
            type: "DEVICE_AUTH",
            deviceId: this.deviceId,
            authToken: this.getDeviceAuthToken(),
          }),
        );

        // Process offline queue
        this.processOfflineQueue();
      });

      this.ws.on("message", (data) => {
        const message = JSON.parse(data);
        this.handleServerMessage(message);
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

      this.ws.on("close", () => {
        console.log("WebSocket connection closed");
        this.scheduleReconnect();
      });
    } catch (error) {
      console.error("Error connecting to backend:", error);
      this.scheduleReconnect();
    }
  }

  sendUpdate(hubstaffData, currentUser) {
    const payload = {
      type: "HUBSTAFF_UPDATE",
      deviceId: this.deviceId,
      timestamp: new Date().toISOString(),
      hubstaff: hubstaffData,
      currentUser: currentUser,
      agentVersion: "1.0.0",
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      // Queue for offline processing
      this.offlineQueue.push(payload);
      console.log("Queued update for offline processing");
    }
  }

  processOfflineQueue() {
    while (this.offlineQueue.length > 0) {
      const payload = this.offlineQueue.shift();
      this.ws.send(JSON.stringify(payload));
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      console.log(
        `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
      );

      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    }
  }

  getDeviceId() {
    // Generate or read device identifier
    // Could be MAC address, hostname, or stored UUID
    const os = require("os");
    return `hvnc_${os.hostname()}_${os.networkInterfaces().eth0?.[0]?.mac || "unknown"}`;
  }
}
```

#### **HTTP Fallback (If WebSocket fails):**

```javascript
const axios = require("axios");

class HTTPBackendSync {
  async sendUpdate(hubstaffData, currentUser) {
    try {
      const payload = {
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        hubstaff: hubstaffData,
        currentUser: currentUser,
      };

      const response = await axios.post(
        "https://api.mydeeptech.ng/api/hvnc/hubstaff/timer-update",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Device-Auth": this.getDeviceAuthToken(),
          },
          timeout: 10000, // 10 second timeout
        },
      );

      if (response.data.success) {
        console.log("Timer update sent successfully");
        return true;
      } else {
        console.error("Backend rejected update:", response.data.message);
        return false;
      }
    } catch (error) {
      console.error("Error sending HTTP update:", error.message);
      return false;
    }
  }
}
```

---

## 🔄 Main Application Loop

### **Complete PC Agent Implementation:**

```javascript
class HubstaffPCAgent {
  constructor() {
    this.hubstaffMonitor = new HubstaffMonitor();
    this.userDetector = new HVNCUserDetector();
    this.backendSync = new BackendSync();
    this.updateInterval = 30000; // 30 seconds
    this.isRunning = false;
  }

  async start() {
    console.log("Starting Hubstaff PC Agent...");

    // Connect to backend
    this.backendSync.connect();

    // Start monitoring loop
    this.isRunning = true;
    this.monitoringLoop();

    console.log("Hubstaff PC Agent started successfully");
  }

  async monitoringLoop() {
    while (this.isRunning) {
      try {
        // Get Hubstaff status
        const hubstaffStatus = await this.hubstaffMonitor.getHubstaffStatus();

        // Get current HVNC user
        const currentUser = await this.userDetector.getCurrentUser();

        // Send update to backend
        this.backendSync.sendUpdate(hubstaffStatus, currentUser);

        // Log current state
        this.logCurrentState(hubstaffStatus, currentUser);
      } catch (error) {
        console.error("Error in monitoring loop:", error);
      }

      // Wait before next update
      await this.sleep(this.updateInterval);
    }
  }

  logCurrentState(hubstaffStatus, currentUser) {
    const timestamp = new Date().toISOString();

    if (hubstaffStatus.isRunning && hubstaffStatus.timer.isActive) {
      const userInfo = currentUser
        ? `${currentUser.userId} on device ${currentUser.deviceId}`
        : "No HVNC user detected";

      console.log(
        `[${timestamp}] Hubstaff Active: ${hubstaffStatus.timer.currentTime} | User: ${userInfo}`,
      );
    } else {
      console.log(
        `[${timestamp}] Hubstaff: ${hubstaffStatus.isRunning ? "Paused" : "Not running"}`,
      );
    }
  }

  stop() {
    console.log("Stopping Hubstaff PC Agent...");
    this.isRunning = false;
    if (this.backendSync.ws) {
      this.backendSync.ws.close();
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Start the agent
const agent = new HubstaffPCAgent();

process.on("SIGINT", () => {
  agent.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  agent.stop();
  process.exit(0);
});

agent.start();
```

---

## 📦 Required Dependencies

### **Package.json:**

```json
{
  "name": "hvnc-hubstaff-agent",
  "version": "1.0.0",
  "description": "PC Agent for HVNC Hubstaff integration",
  "main": "index.js",
  "dependencies": {
    "ws": "^8.13.0",
    "axios": "^1.4.0",
    "node-process-list": "^2.0.0",
    "node-win32-window": "^1.0.0",
    "winreg": "^1.2.4"
  },
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "install-service": "node install-service.js"
  }
}
```

### **Installation Commands:**

```bash
# Install dependencies
npm install

# Install as Windows service (optional)
npm run install-service

# Run in development
npm run dev

# Run in production
npm start
```

---

## 🛠️ Configuration & Setup

### **Config File (config.json):**

```json
{
  "backend": {
    "websocketUrl": "wss://api.mydeeptech.ng/hvnc/hubstaff-sync",
    "httpUrl": "https://api.mydeeptech.ng/api/hvnc/hubstaff",
    "authToken": "device_auth_token_here"
  },
  "monitoring": {
    "updateInterval": 30000,
    "maxRetries": 10,
    "hubstaffProcessName": "hubstaff.exe"
  },
  "device": {
    "id": "auto", // Will auto-generate if not specified
    "name": "HVNC-Device-001"
  },
  "logging": {
    "level": "info",
    "file": "logs/hubstaff-agent.log"
  }
}
```

### **Windows Service Installation (install-service.js):**

```javascript
const { Service } = require("node-windows");

// Create a new service object
const svc = new Service({
  name: "HVNC Hubstaff Agent",
  description: "Monitors Hubstaff timer and syncs with MyDeepTech backend",
  script: require("path").join(__dirname, "index.js"),
  nodeOptions: ["--max_old_space_size=4096"],
});

// Listen for the "install" event
svc.on("install", () => {
  console.log("HVNC Hubstaff Agent service installed successfully");
  svc.start();
});

// Listen for the "start" event
svc.on("start", () => {
  console.log("HVNC Hubstaff Agent service started");
});

// Install the service
svc.install();
```

---

## 🔍 Testing & Debugging

### **Testing Scenarios:**

```bash
# Test 1: Hubstaff not running
# Expected: isRunning: false, timer: null

# Test 2: Hubstaff running, timer paused
# Expected: isRunning: true, timer.isActive: false

# Test 3: Hubstaff active timer
# Expected: isRunning: true, timer.isActive: true, timer.totalSeconds > 0

# Test 4: HVNC user connected
# Expected: currentUser contains userId, sessionId, deviceId

# Test 5: No HVNC user
# Expected: currentUser: null
```

### **Debug Mode:**

```javascript
// Add debug logging
const DEBUG = process.env.DEBUG === "true";

function debugLog(...args) {
  if (DEBUG) {
    console.log("[DEBUG]", new Date().toISOString(), ...args);
  }
}

// Usage
debugLog("Hubstaff process found:", hubstaffProcess);
debugLog("Window title:", windowTitle);
debugLog("Parsed timer:", timerInfo);
```

### **Sample Debug Output:**

```
[2026-03-16T14:30:00.123Z] Starting Hubstaff PC Agent...
[2026-03-16T14:30:00.456Z] Connected to MyDeepTech backend
[DEBUG] [2026-03-16T14:30:30.789Z] Hubstaff process found: { pid: 1234, name: 'hubstaff.exe' }
[DEBUG] [2026-03-16T14:30:30.790Z] Window title: "03:45:22 - MyDeepTech Project - Hubstaff"
[DEBUG] [2026-03-16T14:30:30.791Z] Parsed timer: { isActive: true, elapsed: "03:45:22", totalSeconds: 13522 }
[2026-03-16T14:30:30.792Z] Hubstaff Active: 03:45:22 | User: dtuser_123 on device device_789
```

---

## 🚀 Deployment Steps

### **1. Development Setup:**

```bash
git clone <hvnc-hubstaff-agent-repo>
cd hvnc-hubstaff-agent
npm install
cp config.example.json config.json
# Edit config.json with backend URLs and auth token
npm run dev
```

### **2. Production Deployment:**

```bash
# Copy agent to target PC
scp -r hvnc-hubstaff-agent user@remote-pc:C:/HVNC/
# OR use RDP/TeamViewer to transfer files

# On remote PC:
cd C:/HVNC/hvnc-hubstaff-agent
npm install --production
npm run install-service
```

### **3. Monitoring & Maintenance:**

```bash
# Check service status
sc query "HVNC Hubstaff Agent"

# View logs
type logs\hubstaff-agent.log | more

# Restart service
sc stop "HVNC Hubstaff Agent"
sc start "HVNC Hubstaff Agent"

# Update agent
# Stop service, replace files, start service
```

---

## 📋 Delivery Checklist

### **Required Deliverables:**

- [ ] **Hubstaff Process Monitor** - Extracts timer from window title
- [ ] **HVNC User Detection** - Integrates with existing session management
- [ ] **WebSocket Communication** - Real-time sync with backend
- [ ] **Offline Queue Management** - Handles connection failures
- [ ] **Windows Service Support** - Runs as background service
- [ ] **Configuration System** - Easy setup and customization
- [ ] **Error Handling & Logging** - Robust error management
- [ ] **Installation Package** - Easy deployment to remote PCs

### **Testing Requirements:**

- [ ] Works with Hubstaff desktop app (latest version)
- [ ] Correctly parses timer from window titles
- [ ] Handles Hubstaff start/stop/pause scenarios
- [ ] Integrates with existing HVNC user detection
- [ ] Maintains stable WebSocket connection
- [ ] Queues updates during offline periods
- [ ] Recovers gracefully from errors

---

## 💡 Pro Tips

1. **Timer Parsing**: Test with different Hubstaff UI languages/themes
2. **Process Monitoring**: Handle multiple Hubstaff processes (Personal vs Business)
3. **User Detection**: Cache user info to avoid repeated lookups
4. **Network Resilience**: Implement exponential backoff for reconnections
5. **Performance**: Minimize CPU/memory usage for background operation

The PC Agent is crucial for the entire system - it's the data source that makes everything else possible. Focus on reliability and accurate timer detection above all else!
