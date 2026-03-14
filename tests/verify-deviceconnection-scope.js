/**
 * Test script to verify deviceConnection scope fix in start_session
 * Run with: node tests/verify-deviceconnection-scope.js
 */

const fs = require("fs");
const path = require("path");

function verifyDeviceConnectionScope() {
  console.log(
    "🔍 Verifying deviceConnection scope fix in start_session handler...\n",
  );

  try {
    const websocketServicePath = path.join(
      __dirname,
      "../services/hvnc-websocket.service.js",
    );
    const websocketCode = fs.readFileSync(websocketServicePath, "utf8");

    // Find the start_session handler
    const startSessionStart = websocketCode.indexOf(
      'socket.on("start_session"',
    );
    if (startSessionStart === -1) {
      console.log("❌ FAIL: Could not find start_session handler");
      return false;
    }

    // Find the end of the start_session handler - look for the closing brace of the try-catch
    let handlerEnd = startSessionStart;
    let braceCount = 0;
    let inStartSessionHandler = false;

    for (let i = startSessionStart; i < websocketCode.length; i++) {
      const char = websocketCode[i];
      if (char === "{") {
        braceCount++;
        inStartSessionHandler = true;
      } else if (char === "}") {
        braceCount--;
        if (inStartSessionHandler && braceCount === 0) {
          handlerEnd = i + 1;
          break;
        }
      }
    }

    const startSessionHandler = websocketCode.substring(
      startSessionStart,
      handlerEnd,
    );

    console.log("📋 Test 1: deviceConnection declaration position...");

    // Check if deviceConnection is declared early
    const deviceConnectionDecl = startSessionHandler.indexOf(
      "const deviceConnection = connectedDevices.get(device_id);",
    );
    if (deviceConnectionDecl === -1) {
      console.log("❌ FAIL: deviceConnection declaration not found");
      return false;
    }

    // Check if it comes before session reuse logic
    const sessionReuseStart = startSessionHandler.indexOf(
      "activeSessions.set(existingSession._id.toString()",
    );
    if (sessionReuseStart === -1) {
      console.log("❌ FAIL: Session reuse logic not found");
      return false;
    }

    if (deviceConnectionDecl < sessionReuseStart) {
      console.log(
        "✅ PASS: deviceConnection declared before session reuse logic",
      );
    } else {
      console.log(
        "❌ FAIL: deviceConnection declared after session reuse logic",
      );
      return false;
    }

    console.log("\n📋 Test 2: deviceConnection usage in session reuse...");

    // Check that deviceConnection is used in session reuse
    const deviceSocketUsage = startSessionHandler.indexOf(
      "deviceSocket: deviceConnection.socket,",
    );
    const deviceUsage = startSessionHandler.indexOf(
      "device: deviceConnection.device,",
    );

    if (deviceSocketUsage !== -1 && deviceUsage !== -1) {
      console.log("✅ PASS: deviceConnection properly used in session reuse");

      // Verify these usages come after the declaration
      if (
        deviceSocketUsage > deviceConnectionDecl &&
        deviceUsage > deviceConnectionDecl
      ) {
        console.log("✅ PASS: deviceConnection usages come after declaration");
      } else {
        console.log("❌ FAIL: deviceConnection used before declaration");
        return false;
      }
    } else {
      console.log("❌ FAIL: deviceConnection not used in session reuse");
      return false;
    }

    console.log("\n📋 Test 3: Device online check position...");

    // Check that device online check happens early
    const deviceOnlineCheck = startSessionHandler.indexOf(
      "if (!deviceConnection) {",
    );
    if (deviceOnlineCheck !== -1 && deviceOnlineCheck < sessionReuseStart) {
      console.log("✅ PASS: Device online check positioned correctly");
    } else {
      console.log("❌ FAIL: Device online check not positioned correctly");
      return false;
    }

    console.log("\n📋 Test 4: Error handling verification...");

    // Check that catch block and session_error exist in the handler
    const hasCatchBlock = startSessionHandler.includes("} catch (error)");
    const hasSessionErrorEmit = startSessionHandler.includes(
      'socket.emit("session_error"',
    );
    const hasErrorMessage = startSessionHandler.includes(
      "message: error.message",
    );

    if (hasCatchBlock && hasSessionErrorEmit && hasErrorMessage) {
      console.log("✅ PASS: Proper error handling in place");
    } else {
      console.log("❌ FAIL: Error handling components missing");
      console.log(`   Catch block: ${hasCatchBlock}`);
      console.log(`   Session error emit: ${hasSessionErrorEmit}`);
      console.log(`   Error message: ${hasErrorMessage}`);
      return false;
    }

    console.log("\n🎉 ALL DEVICECONNECTION SCOPE TESTS PASSED!");
    console.log("✅ deviceConnection declared before usage");
    console.log("✅ Session reuse logic properly scoped");
    console.log("✅ Device online check positioned correctly");
    console.log("✅ Error handling in place");
    console.log(
      '\n🚀 The "deviceConnection is not defined" error should be resolved!',
    );

    return true;
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    return false;
  }
}

// Check if this script is run directly
if (require.main === module) {
  console.log("🔍 Verifying deviceConnection scope fix...\n");

  const success = verifyDeviceConnectionScope();

  if (success) {
    console.log("\n✅ DeviceConnection scope verification complete!");
    process.exit(0);
  } else {
    console.log("\n❌ DeviceConnection scope verification failed!");
    process.exit(1);
  }
}

module.exports = { verifyDeviceConnectionScope };
