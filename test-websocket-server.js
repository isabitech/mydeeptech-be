const WebSocket = require("ws");

// Create a simple WebSocket server for testing
const wss = new WebSocket.Server({ port: 8081 });

wss.on("connection", function connection(ws, req) {
  console.log("🔌 WebSocket connection established");
  console.log("   Origin:", req.headers.origin);
  console.log("   User-Agent:", req.headers["user-agent"]);
  console.log("   Remote Address:", req.socket.remoteAddress);

  ws.on("message", function incoming(message) {
    console.log("📨 Received message:", message.toString());

    // Echo back the message
    ws.send("Echo: " + message.toString());
  });

  ws.on("close", function close() {
    console.log("🔌 WebSocket connection closed");
  });

  ws.on("error", function error(err) {
    console.log("❌ WebSocket error:", err);
  });

  // Send a welcome message
  ws.send("WebSocket connection successful!");
});

console.log("🚀 WebSocket server running on port 8081");
console.log("💡 Test with: ws://localhost:8081");
