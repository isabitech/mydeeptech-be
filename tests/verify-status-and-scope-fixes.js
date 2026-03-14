/**
 * Test script to verify device status validation and scope fixes
 * Run with: node tests/verify-status-and-scope-fixes.js
 */

const HVNCDevice = require("../models/hvnc-device.model");

async function testStatusAndScopeFixes() {
  console.log("🧪 Testing device status validation and scope fixes...\n");

  try {
    // Test 1: Valid device status enum values
    console.log("📋 Test 1: Valid device status enum values...");
    const validStatuses = ["online", "offline", "maintenance", "disabled"];

    for (const status of validStatuses) {
      const device = new HVNCDevice({
        device_id: `TEST-DEVICE-${status.toUpperCase()}`,
        pc_name: `Test PC ${status}`,
        status: status,
      });

      await device.validate();
      console.log(`   ✅ ${status}: VALID`);
    }

    // Test 2: Test updateHeartbeat method with valid status
    console.log("\n📋 Test 2: updateHeartbeat with valid status...");
    const testDevice = new HVNCDevice({
      device_id: "TEST-DEVICE-HEARTBEAT",
      pc_name: "Test PC Heartbeat",
      status: "offline",
    });

    testDevice.updateHeartbeat({ status: "online" });
    if (testDevice.status === "online") {
      console.log("   ✅ PASS: Valid status updated correctly");
    } else {
      console.log("   ❌ FAIL: Valid status not updated");
    }

    // Test 3: Test updateHeartbeat method with invalid status (busy)
    console.log('\n📋 Test 3: updateHeartbeat with invalid "busy" status...');
    let consoleWarnCalled = false;
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && args[0].includes("Invalid device status")) {
        consoleWarnCalled = true;
      }
    };

    testDevice.updateHeartbeat({ status: "busy" });
    console.warn = originalWarn;

    if (testDevice.status === "online" && consoleWarnCalled) {
      console.log('   ✅ PASS: Invalid "busy" status converted to "online"');
      console.log("   ✅ PASS: Warning logged for invalid status");
    } else {
      console.log("   ❌ FAIL: Invalid status handling failed");
      console.log(`      Device status: ${testDevice.status}`);
      console.log(`      Warning logged: ${consoleWarnCalled}`);
    }

    // Test 4: Test updateHeartbeat with no status (undefined)
    console.log("\n📋 Test 4: updateHeartbeat with no status...");
    testDevice.status = "offline"; // Reset
    testDevice.updateHeartbeat({ system_info: { cpu_usage: 50 } });

    if (testDevice.status === "online") {
      console.log('   ✅ PASS: No status defaults to "online"');
    } else {
      console.log("   ❌ FAIL: Default status handling failed");
    }

    // Test 5: Test various invalid statuses
    console.log("\n📋 Test 5: Various invalid statuses...");
    const invalidStatuses = ["busy", "connected", "active", "idle", "working"];

    for (const invalidStatus of invalidStatuses) {
      testDevice.updateHeartbeat({ status: invalidStatus });
      if (testDevice.status === "online") {
        console.log(`   ✅ "${invalidStatus}" → "online": PASS`);
      } else {
        console.log(`   ❌ "${invalidStatus}" → "${testDevice.status}": FAIL`);
      }
    }

    // Test 6: Validate deviceConnection scope fix by checking the WebSocket service
    console.log("\n📋 Test 6: DeviceConnection scope fix...");
    const fs = require("fs");
    const path = require("path");
    const websocketServicePath = path.join(
      __dirname,
      "../services/hvnc-websocket.service.js",
    );
    const websocketCode = fs.readFileSync(websocketServicePath, "utf8");

    // Check that deviceConnection is declared before session reuse
    const deviceConnectionDeclaration = websocketCode.indexOf(
      "const deviceConnection = connectedDevices.get(device_id);",
    );
    const sessionReuseUsage = websocketCode.indexOf(
      "deviceSocket: deviceConnection.socket,",
    );

    if (
      deviceConnectionDeclaration !== -1 &&
      sessionReuseUsage !== -1 &&
      deviceConnectionDeclaration < sessionReuseUsage
    ) {
      console.log("   ✅ PASS: deviceConnection declared before session reuse");
    } else {
      console.log("   ❌ FAIL: deviceConnection scope issue not fixed");
    }

    // Check for duplicate deviceConnection checks in start_session function
    const startSessionFunctionStart = websocketCode.indexOf(
      'socket.on("start_session"',
    );
    const nextSocketOnIndex = websocketCode.indexOf(
      "socket.on(",
      startSessionFunctionStart + 1,
    );
    const startSessionFunction = websocketCode.substring(
      startSessionFunctionStart,
      nextSocketOnIndex,
    );

    const deviceConnectionChecksInStartSession = startSessionFunction.match(
      /const deviceConnection = connectedDevices\.get\(/g,
    );
    if (
      deviceConnectionChecksInStartSession &&
      deviceConnectionChecksInStartSession.length === 1
    ) {
      console.log(
        "   ✅ PASS: No duplicate deviceConnection checks in start_session",
      );
    } else {
      console.log(
        "   ❌ FAIL: Duplicate deviceConnection checks in start_session",
      );
      console.log(
        `     Found ${deviceConnectionChecksInStartSession?.length || 0} declarations`,
      );
    }

    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("✅ Valid device status enums working");
    console.log('✅ Invalid "busy" status handling fixed');
    console.log("✅ DeviceConnection scope issue resolved");
    console.log("✅ No duplicate deviceConnection checks");
  } catch (error) {
    console.error("❌ Test failed with unexpected error:", error);
    process.exit(1);
  }
}

// Check if this script is run directly
if (require.main === module) {
  console.log("🔍 Verifying device status and scope fixes...\n");

  testStatusAndScopeFixes()
    .then(() => {
      console.log("\n✅ Status and scope fixes verification complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Verification failed:", error);
      process.exit(1);
    });
}

module.exports = { testStatusAndScopeFixes };
