/**
 * Test script to verify device status fix in /api/hvnc/user/devices endpoint
 */

const axios = require("axios");

// Test the device status endpoint
async function testDeviceStatusEndpoint() {
  console.log("🧪 Testing Device Status Fix");
  console.log("============================");

  const SERVER_URL = process.env.SERVER_URL || "http://localhost:4000";

  // You'll need to replace this with a valid user JWT token
  const USER_TOKEN = "your-user-jwt-token-here";

  try {
    console.log("📋 Testing /api/hvnc/user/devices endpoint...");

    const response = await axios.get(`${SERVER_URL}/api/hvnc/user/devices`, {
      headers: {
        Authorization: `Bearer ${USER_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ API Response:");
    console.log("   Status:", response.status);
    console.log("   Device count:", response.data.devices?.length || 0);

    if (response.data.devices && response.data.devices.length > 0) {
      console.log("   Device statuses:");
      response.data.devices.forEach((device) => {
        console.log(
          `     ${device.name} (${device.deviceId}): ${device.status}`,
        );
        console.log(`       Last seen: ${device.lastSeen}`);
      });

      // Check if any devices are now showing as Online
      const onlineDevices = response.data.devices.filter(
        (d) => d.status === "Online",
      );
      const offlineDevices = response.data.devices.filter(
        (d) => d.status === "Offline",
      );

      console.log("");
      console.log(`📊 Summary:`);
      console.log(`   Online devices: ${onlineDevices.length}`);
      console.log(`   Offline devices: ${offlineDevices.length}`);

      if (onlineDevices.length > 0) {
        console.log("✅ SUCCESS: At least one device is showing as Online!");
        console.log(
          "   The fix is working - devices connected via WebSocket are now detected.",
        );
      } else {
        console.log("⚠️  All devices still showing as Offline");
        console.log("   This means either:");
        console.log("   1. No devices are currently connected via WebSocket");
        console.log("   2. The WebSocket service needs to be restarted");
        console.log(
          "   3. There may be an import issue with isDeviceConnected function",
        );
      }
    } else {
      console.log("ℹ️  No devices found for this user");
    }
  } catch (error) {
    if (error.response) {
      console.log(
        `❌ API Error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`,
      );
    } else {
      console.log(`❌ Network Error: ${error.message}`);
    }

    if (USER_TOKEN === "your-user-jwt-token-here") {
      console.log("");
      console.log(
        "💡 Note: Please set a valid USER_TOKEN in the script to test",
      );
      console.log(
        "   You can get a user JWT token from your authentication system",
      );
    }
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDeviceStatusEndpoint().catch(console.error);
}

module.exports = { testDeviceStatusEndpoint };
