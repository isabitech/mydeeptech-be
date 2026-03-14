const WebSocket = require("ws");

console.log("🚀 Testing WebSocket connection to ws://localhost:8081");

const ws = new WebSocket("ws://localhost:8081");

ws.on("open", function open() {
  console.log("✅ WebSocket connection opened successfully");

  // Send a test message
  ws.send("Hello from test client!");
});

ws.on("message", function message(data) {
  console.log("📨 Received from server:", data.toString());
});

ws.on("close", function close() {
  console.log("🔌 WebSocket connection closed");
  process.exit(0);
});

ws.on("error", function error(err) {
  console.log("❌ WebSocket connection error:", err.message);
  process.exit(1);
});

// Close after 5 seconds
setTimeout(() => {
  console.log("⏰ Closing connection after test");
  ws.close();
}, 5000);
