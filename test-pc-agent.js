const io = require("socket.io-client");
const jwt = require("jsonwebtoken");
const envConfig = require("./config/envConfig");

console.log("🚀 Starting HVNC PC Agent Test...");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Generate token for the provided device ID
const deviceId = "DEVICE-3863CCC752739530";
const deviceToken = jwt.sign(
  {
    id: "69b428d2f4802d219cd197e8", // Actual ObjectId from NEW database
    device_id: deviceId,
    type: "device",
  },
  envConfig.jwt.JWT_SECRET,
  {
    expiresIn: "1h",
  },
);

console.log("🔍 Testing device:", deviceId);
console.log("🔑 Generated token:", deviceToken.substring(0, 50) + "...");

const socket = io("http://localhost:4000/hvnc-device", {
  auth: { token: deviceToken },
  transports: ["websocket", "polling"],
  reconnection: false, // Disable for testing
  forceNew: true,
});

// Connection events
socket.on("connect", () => {
  console.log("✅ Socket.IO connection established");
  console.log(`📋 Socket ID: ${socket.id}`);
  console.log("⏳ Waiting for device authentication...");
});

// ✅ This should fire if authentication succeeds
socket.on("authenticated", (data) => {
  console.log("🎉 AUTHENTICATION SUCCESSFUL!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Device Data:", data);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Send test device status
  socket.emit("device_status", {
    status: "online",
    cpu_usage: 45.2,
    memory_usage: 67.8,
    disk_usage: 23.1,
    timestamp: new Date().toISOString(),
  });

  console.log("📊 Device status sent");

  // Close connection after test
  setTimeout(() => {
    console.log("✅ Test completed successfully");
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

// ❌ Connection errors
socket.on("connect_error", (error) => {
  console.error("❌ Connection failed:", error.message);
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (
    error.message.includes("Authentication failed") ||
    error.message.includes("Device authentication token required")
  ) {
    console.error("🔑 Solution: Get a valid device token");
    console.error("   Run: GET /api/hvnc/devices/auth to get token");
  } else if (error.message.includes("Device not found")) {
    console.error("🖥️ Solution: Register device first");
    console.error("   Run: POST /api/hvnc/devices to create device");
  } else if (error.message.includes("Device is disabled")) {
    console.error("⛔ Solution: Enable device in admin panel");
  } else {
    console.error("🌐 Network or server error");
  }

  process.exit(1);
});

// Disconnection
socket.on("disconnect", (reason) => {
  console.log("🔌 Disconnected:", reason);
  if (reason !== "io client disconnect") {
    console.error("❌ Unexpected disconnection");
    process.exit(1);
  }
});

// Timeout for test
setTimeout(() => {
  console.error("❌ Test timed out - no response within 10 seconds");
  console.error("📝 This may indicate authentication or server issues");
  process.exit(1);
}, 10000);

console.log("🌐 Connecting to: http://localhost:4000/hvnc-device");
