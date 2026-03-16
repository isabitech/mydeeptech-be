/**
 * Test script to verify HVNCSession creation with required session_id field
 * Run with: node tests/verify-session-creation.js
 */

const HVNCSession = require("../models/hvnc-session.model");

async function testSessionCreation() {
  console.log("🧪 Testing HVNCSession creation validation...\n");

  try {
    // Test 1: Create session WITHOUT session_id (should fail)
    console.log(
      "❌ Test 1: Creating session without session_id (should fail)...",
    );

    const invalidSession = new HVNCSession({
      // session_id: missing!
      user_email: "test@example.com",
      device_id: "DEVICE-TEST-001",
      started_at: new Date(),
      status: "active",
      client_info: {
        connection_type: "websocket",
        user_id: "507f1f77bcf86cd799439011",
      },
    });

    try {
      await invalidSession.validate();
      console.log("❌ ERROR: Validation should have failed but passed!");
      process.exit(1);
    } catch (validationError) {
      console.log(
        "✅ PASS: Validation correctly failed for missing session_id",
      );
      console.log(`   Error: ${validationError.errors.session_id.message}\n`);
    }

    // Test 2: Create session WITH session_id (should pass)
    console.log("✅ Test 2: Creating session with session_id (should pass)...");

    const validSession = new HVNCSession({
      session_id: "sess_test_1773495679978", // Required field provided
      user_email: "test@example.com",
      device_id: "DEVICE-TEST-001",
      started_at: new Date(),
      status: "active",
      client_info: {
        connection_type: "websocket",
        user_id: "507f1f77bcf86cd799439011",
      },
    });

    await validSession.validate();
    console.log("✅ PASS: Validation succeeded with session_id provided");
    console.log(`   session_id: ${validSession.session_id}\n`);

    // Test 3: Test uniqueness constraint
    console.log("📋 Test 3: Testing session_id uniqueness...");

    const duplicateSession = new HVNCSession({
      session_id: "sess_test_1773495679978", // Same ID as above
      user_email: "test2@example.com",
      device_id: "DEVICE-TEST-002",
      started_at: new Date(),
      status: "active",
    });

    // This would fail on actual save due to unique constraint, but validation passes
    await duplicateSession.validate();
    console.log(
      "✅ PASS: Schema validation passed (uniqueness checked on save)",
    );
    console.log(
      "   Note: Uniqueness constraint is enforced at database level\n",
    );

    // Test 4: Test different ID formats
    console.log("📋 Test 4: Testing different session_id formats...");

    const idFormats = [
      "sess_55yqqytsc_1773495679978", // Frontend format
      `sess_${Date.now()}`, // Timestamp format
      `sess_user123_${Date.now()}`, // User + timestamp
      "session_" + Math.random().toString(36).substr(2, 9), // Random
    ];

    for (const sessionId of idFormats) {
      const testSession = new HVNCSession({
        session_id: sessionId,
        user_email: "test@example.com",
        device_id: "DEVICE-TEST-003",
        started_at: new Date(),
        status: "active",
      });

      await testSession.validate();
      console.log(`   ✅ ${sessionId}: VALID`);
    }

    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("✅ session_id field is correctly required");
    console.log("✅ HVNCSession validation works properly");
    console.log("✅ Different session_id formats are accepted\n");

    console.log("💡 Summary for WebSocket Implementation:");
    console.log("   1. Always provide session_id when creating HVNCSession");
    console.log("   2. Get session_id from frontend data or query params");
    console.log("   3. Generate fallback session_id if not provided");
    console.log(
      "   4. Use session.session_id (not session._id) for communication",
    );
  } catch (error) {
    console.error("❌ Test failed with unexpected error:", error);
    process.exit(1);
  }
}

// Check if this script is run directly
if (require.main === module) {
  console.log("🔍 Verifying HVNCSession creation requirements...\n");

  testSessionCreation()
    .then(() => {
      console.log("\n✅ Session creation validation verification complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Verification failed:", error);
      process.exit(1);
    });
}

module.exports = { testSessionCreation };
