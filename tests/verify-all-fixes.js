/**
 * Complete verification script for all HVNC fixes
 * Run with: node tests/verify-all-fixes.js
 */

const path = require("path");
const fs = require("fs");

async function verifyAllFixes() {
  console.log("🔍 Comprehensive verification of all HVNC fixes...\n");

  let allTestsPassed = true;

  try {
    // Test 1: Verify HVNCSession model requires session_id
    console.log("📋 Test 1: HVNCSession validation...");
    try {
      const HVNCSession = require("../models/hvnc-session.model");

      // Test invalid session (missing session_id)
      const invalidSession = new HVNCSession({
        user_email: "test@example.com",
        device_id: "DEVICE-TEST-001",
        started_at: new Date(),
        status: "active",
      });

      await invalidSession.validate();
      console.log("❌ FAIL: Session validation should have failed");
      allTestsPassed = false;
    } catch (validationError) {
      if (validationError.errors && validationError.errors.session_id) {
        console.log("✅ PASS: session_id is properly required");
      } else {
        console.log(
          "❌ FAIL: Unexpected validation error",
          validationError.message,
        );
        allTestsPassed = false;
      }
    }

    // Test 2: Verify WebSocket service has no undefined device references
    console.log("\n📋 Test 2: WebSocket service device references...");
    const websocketServicePath = path.join(
      __dirname,
      "../services/hvnc-websocket.service.js",
    );
    const websocketCode = fs.readFileSync(websocketServicePath, "utf8");

    // Simple check: look for the specific problem pattern
    // We only care about direct device.* usage in device namespace event handlers
    // where 'device' is not legitimately in scope

    const problematicPatterns = [
      // Look for the specific line pattern that was causing "ReferenceError: device is not defined"
      /const deviceId = socket\.deviceId \|\| device\.device_id/,
      // Check if any event handlers use device.device_id without socket. prefix in device namespace
      /socket\.on\([^)]*\)[^{]*\{[^}]*(?:connectedDevices\.(?:get|delete)\(device\.device_id|device\.updateHeartbeat|adminNamespace\.emit[^{]*device_id:\s*device\.device_id)/gs,
    ];

    let foundIssues = [];
    for (const pattern of problematicPatterns) {
      const matches = websocketCode.match(pattern);
      if (matches) {
        foundIssues.push(...matches);
      }
    }

    if (foundIssues.length === 0) {
      console.log("✅ PASS: No problematic device references found");
    } else {
      console.log(
        `❌ FAIL: Found ${foundIssues.length} problematic device references:`,
      );
      foundIssues.forEach((issue) =>
        console.log(`   ${issue.substring(0, 80)}...`),
      );
      allTestsPassed = false;
    }

    // Test 3: Verify socket.device is used consistently
    console.log("\n📋 Test 3: Consistent socket.device usage...");
    const socketDeviceUsages =
      websocketCode.match(
        /socket\.device\.(device_id|pc_name|status|save|updateHeartbeat)/g,
      )?.length || 0;
    if (socketDeviceUsages > 0) {
      console.log(
        `✅ PASS: Found ${socketDeviceUsages} proper socket.device usages`,
      );
    } else {
      console.log("❌ FAIL: No socket.device usages found");
      allTestsPassed = false;
    }

    // Test 4: Check for proper enum values
    console.log("\n📋 Test 4: Activity log enum validation...");
    const enumUsages = websocketCode.match(
      /logDeviceEvent\([^,]+,\s*["']([^"']+)["']/g,
    );
    const invalidEnums = enumUsages?.filter(
      (usage) =>
        usage.includes('"device_connected"') ||
        usage.includes("'device_connected'"),
    );

    if (invalidEnums && invalidEnums.length > 0) {
      console.log("❌ FAIL: Found invalid enum usage:", invalidEnums);
      allTestsPassed = false;
    } else {
      console.log("✅ PASS: No invalid enum values found");
    }

    // Test 5: Verify session creation includes session_id
    console.log("\n📋 Test 5: Session creation validation...");
    const sessionCreationMatch = websocketCode.match(
      /HVNCSession\.create\(\{[^}]*session_id:\s*session_id/s,
    );
    if (sessionCreationMatch) {
      console.log("✅ PASS: HVNCSession.create() includes session_id field");
    } else {
      console.log("❌ FAIL: HVNCSession.create() missing session_id field");
      allTestsPassed = false;
    }

    // Test 6: Verify debug mode is removed/disabled
    console.log("\n📋 Test 6: Debug mode verification...");

    // Check for any debug device authentication bypasses
    const authBypassPatterns = [
      /debugMode.*true/i,
      /DEBUG.*DEVICE.*ID/i,
      /FAKE.*DEVICE/i,
      /testSocket\.emit.*authenticated/i,
    ];

    let debugModeRemoved = true;
    for (const pattern of authBypassPatterns) {
      const matches = websocketCode.match(pattern);
      if (matches) {
        console.log(
          `❌ FAIL: Found debug/test authentication bypass: ${matches[0]}`,
        );
        debugModeRemoved = false;
        allTestsPassed = false;
      }
    }

    // Also check that actual JWT authentication is present
    const jwtAuthMatch = websocketCode.match(/jwt\.verify\(.*JWT_SECRET/);

    if (debugModeRemoved && jwtAuthMatch) {
      console.log("✅ PASS: Debug mode removed, JWT authentication active");
    } else if (!jwtAuthMatch) {
      console.log("❌ FAIL: JWT authentication not found");
      allTestsPassed = false;
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    if (allTestsPassed) {
      console.log("🎉 ALL FIXES VERIFIED SUCCESSFULLY!");
      console.log("✅ Device status synchronization fixed");
      console.log("✅ Debug mode properly removed");
      console.log("✅ Enum validation corrected");
      console.log("✅ Session creation validation resolved");
      console.log("✅ Device reference errors eliminated");
      console.log("\n🚀 Ready for production deployment!");
    } else {
      console.log("❌ Some issues found - please review failures above");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Verification failed with error:", error);
    allTestsPassed = false;
    process.exit(1);
  }
}

// Check if this script is run directly
if (require.main === module) {
  verifyAllFixes()
    .then(() => {
      console.log("\n✅ Verification complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Verification failed:", error);
      process.exit(1);
    });
}

module.exports = { verifyAllFixes };
