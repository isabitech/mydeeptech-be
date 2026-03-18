/**
 * Quick verification script for HVNCActivityLog enum validation issue
 * Run with: node tests/verify-enum-fix.js
 */

const HVNCActivityLog = require("../models/hvnc-activity-log.model");

async function verifyEnumValidation() {
  console.log("🧪 Testing HVNCActivityLog enum validation...\n");

  try {
    // Test 1: Try to create log with invalid "device_connected"
    console.log(
      '❌ Test 1: Attempting to create log with invalid "device_connected" event...',
    );

    const invalidLog = new HVNCActivityLog({
      device_id: "DEVICE-TEST-001",
      event_type: "device_connected", // This should FAIL
      event_data: { test: "data" },
    });

    try {
      await invalidLog.validate();
      console.log("❌ ERROR: Validation should have failed but passed!");
      process.exit(1);
    } catch (validationError) {
      console.log(
        '✅ PASS: Validation correctly failed for "device_connected"',
      );
      console.log(`   Error: ${validationError.errors.event_type.message}\n`);
    }

    // Test 2: Try to create log with valid "device_online"
    console.log(
      '✅ Test 2: Attempting to create log with valid "device_online" event...',
    );

    const validLog = new HVNCActivityLog({
      device_id: "DEVICE-TEST-002",
      event_type: "device_online", // This should PASS
      event_data: {
        socket_id: "test-socket-123",
        connection_type: "websocket",
        pc_name: "Test PC",
      },
      metadata: {
        status: "success",
        ip_address: "127.0.0.1",
      },
    });

    await validLog.validate();
    console.log('✅ PASS: Validation succeeded for "device_online"\n');

    // Test 3: Verify all valid device event types
    console.log("📋 Test 3: Checking all valid device-related event types...");
    const validDeviceEvents = [
      "device_registration",
      "device_heartbeat",
      "device_online",
      "device_offline",
      "device_disconnected",
      "device_reconnected",
      "device_disabled",
    ];

    for (const eventType of validDeviceEvents) {
      const testLog = new HVNCActivityLog({
        device_id: `TEST-${eventType}`,
        event_type: eventType,
        event_data: { test: "data" },
      });

      await testLog.validate();
      console.log(`   ✅ ${eventType}: VALID`);
    }

    console.log("\n🎉 ALL TESTS PASSED!");
    console.log('✅ "device_connected" is correctly rejected');
    console.log('✅ "device_online" is correctly accepted');
    console.log("✅ All device event types are valid\n");

    console.log("💡 Summary:");
    console.log('   - Use "device_online" for device connections');
    console.log('   - Use "device_offline" for device disconnections');
    console.log('   - Use "device_disconnected" for unexpected disconnections');
    console.log('   - Never use "device_connected" (invalid enum value)');
  } catch (error) {
    console.error("❌ Test failed with unexpected error:", error);
    process.exit(1);
  }
}

// Check if this script is run directly
if (require.main === module) {
  // Simple connection test without requiring full MongoDB setup
  const mongoose = require("mongoose");

  console.log("🔍 Verifying enum validation (schema-level test)...\n");

  // We can test validation without connecting to MongoDB
  verifyEnumValidation()
    .then(() => {
      console.log("\n✅ Enum validation verification complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Verification failed:", error);
      process.exit(1);
    });
}

module.exports = { verifyEnumValidation };
