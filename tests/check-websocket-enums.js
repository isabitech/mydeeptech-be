/**
 * Quick check script to verify WebSocket service uses correct enum values
 * Run with: node tests/check-websocket-enums.js
 */

const fs = require("fs");
const path = require("path");

function checkWebSocketEnums() {
  console.log("🔍 Checking WebSocket service for correct enum usage...\n");

  const websocketPath = path.join(
    __dirname,
    "../services/hvnc-websocket.service.js",
  );

  if (!fs.existsSync(websocketPath)) {
    console.error("❌ WebSocket service file not found");
    process.exit(1);
  }

  const content = fs.readFileSync(websocketPath, "utf8");

  // Check for invalid usage
  const invalidPatterns = [
    "device_connected",
    '"device_connected"',
    "'device_connected'",
  ];

  let hasInvalidUsage = false;

  invalidPatterns.forEach((pattern) => {
    if (content.includes(pattern)) {
      console.log(`❌ Found invalid enum value: ${pattern}`);
      hasInvalidUsage = true;
    }
  });

  if (hasInvalidUsage) {
    console.log("\n❌ WebSocket service still contains invalid enum values!");
    process.exit(1);
  }

  // Check for correct usage
  const validPatterns = [
    "device_online",
    "device_offline",
    "device_disconnected",
  ];

  let validUsageCount = 0;

  validPatterns.forEach((pattern) => {
    const matches = (content.match(new RegExp(pattern, "g")) || []).length;
    if (matches > 0) {
      console.log(`✅ Found ${matches} instance(s) of valid enum: ${pattern}`);
      validUsageCount += matches;
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ No invalid "device_connected" usage found`);
  console.log(`   ✅ Found ${validUsageCount} valid enum usages`);
  console.log(`   ✅ WebSocket service is using correct enum values!`);

  return true;
}

if (require.main === module) {
  try {
    checkWebSocketEnums();
    console.log("\n🎉 WebSocket enum check completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Check failed:", error);
    process.exit(1);
  }
}

module.exports = { checkWebSocketEnums };
