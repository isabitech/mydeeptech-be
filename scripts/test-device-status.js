/**
 * HVNC Device Status Test Script
 * Run this to diagnose device connectivity issues
 */

const axios = require("axios");

// Configuration
const SERVER_URL = process.env.SERVER_URL || "http://localhost:4000";
const DEVICE_ID = "DEVICE-3863CCC752739530";

// Admin JWT token for testing (replace with actual token)
const ADMIN_TOKEN = "your-admin-jwt-token-here";

async function testDeviceStatus() {
  console.log("🧪 HVNC Device Status Test");
  console.log("==========================");
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log("");

  try {
    // Test 1: Check all connected devices
    console.log("📋 Test 1: Getting all connected devices...");
    const connectedResponse = await axios.get(
      `${SERVER_URL}/api/hvnc/admin/debug/connected-devices`,
      {
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ Connected devices response:");
    console.log(
      `   Total devices in DB: ${connectedResponse.data.total_devices}`,
    );
    console.log(
      `   WebSocket connected: ${connectedResponse.data.websocket_connected}`,
    );
    console.log(
      `   Connected device IDs: [${connectedResponse.data.connected_devices.map((d) => d.device_id).join(", ")}]`,
    );

    const targetDevice = connectedResponse.data.devices.find(
      (d) => d.device_id === DEVICE_ID,
    );
    if (targetDevice) {
      console.log(`   Target device status:`);
      console.log(`     DB Status: ${targetDevice.db_status}`);
      console.log(
        `     WebSocket: ${targetDevice.websocket_connected ? "CONNECTED" : "DISCONNECTED"}`,
      );
      console.log(`     Last seen: ${targetDevice.db_last_seen}`);
    } else {
      console.log(`   ❌ Target device ${DEVICE_ID} not found in response`);
    }
    console.log("");

    // Test 2: Check specific device
    console.log("📋 Test 2: Getting specific device status...");
    try {
      const deviceResponse = await axios.get(
        `${SERVER_URL}/api/hvnc/admin/debug/device/${DEVICE_ID}/status`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("✅ Device status response:");
      console.log(`   PC Name: ${deviceResponse.data.pc_name}`);
      console.log(`   DB Status: ${deviceResponse.data.database.status}`);
      console.log(`   DB Last Seen: ${deviceResponse.data.database.last_seen}`);
      console.log(
        `   WebSocket Connected: ${deviceResponse.data.websocket.connected}`,
      );
      console.log(
        `   Total Connected: ${deviceResponse.data.debug_info.total_connected}`,
      );
    } catch (deviceError) {
      console.log(
        `❌ Device-specific check failed: ${deviceError.response?.status} - ${deviceError.response?.data?.error || deviceError.message}`,
      );
    }
    console.log("");

    // Test 3: Refresh device statuses
    console.log("📋 Test 3: Refreshing device statuses...");
    try {
      const refreshResponse = await axios.post(
        `${SERVER_URL}/api/hvnc/admin/debug/refresh-statuses`,
        {},
        {
          headers: {
            Authorization: `Bearer ${ADMIN_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("✅ Refresh response:");
      console.log(`   Message: ${refreshResponse.data.message}`);
      console.log(`   Total devices: ${refreshResponse.data.total_devices}`);
      console.log(
        `   Connected count: ${refreshResponse.data.connected_count}`,
      );
      console.log(
        `   Connected IDs: [${refreshResponse.data.connected_device_ids.join(", ")}]`,
      );
    } catch (refreshError) {
      console.log(
        `❌ Refresh failed: ${refreshError.response?.status} - ${refreshError.response?.data?.error || refreshError.message}`,
      );
    }
    console.log("");

    // Test 4: Test regular device list endpoint
    console.log("📋 Test 4: Testing regular device list...");
    try {
      const devicesResponse = await axios.get(
        `${SERVER_URL}/api/hvnc/admin/devices`,
        {
          headers: {
            Authorization: `Bearer ${ADMIN_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("✅ Regular device list response:");
      console.log(
        `   Total devices: ${devicesResponse.data.devices?.length || 0}`,
      );
      const targetInList = devicesResponse.data.devices?.find(
        (d) => d.device_id === DEVICE_ID,
      );
      if (targetInList) {
        console.log(`   Target device found: status=${targetInList.status}`);
      } else {
        console.log(`   ❌ Target device not found in regular list`);
      }
    } catch (listError) {
      console.log(
        `❌ Regular device list failed: ${listError.response?.status} - ${listError.response?.data?.error || listError.message}`,
      );
    }
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error.response?.status,
      error.response?.data || error.message,
    );
  }

  console.log("");
  console.log("🏁 Test completed!");
  console.log("");
  console.log("💡 Debugging Tips:");
  console.log("   1. Make sure PC agent is running and connected");
  console.log("   2. Check if device shows in connected_devices array");
  console.log("   3. Verify WebSocket connected = true");
  console.log("   4. Run refresh-statuses if database is out of sync");
  console.log("   5. Check server logs for connection/disconnection events");
}

// Run the test
if (require.main === module) {
  // Replace this with actual admin token for testing
  if (ADMIN_TOKEN === "your-admin-jwt-token-here") {
    console.log(
      "❌ Please set a valid ADMIN_TOKEN in the script before running",
    );
    console.log(
      "   You can get an admin token from your authentication system",
    );
    process.exit(1);
  }

  testDeviceStatus().catch(console.error);
}

module.exports = { testDeviceStatus };
