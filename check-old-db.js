const mongoose = require("mongoose");
require("dotenv").config();

// HVNC Device Schema (simplified for checking)
const hvncDeviceSchema = new mongoose.Schema(
  {
    device_id: String,
    pc_name: String,
    hostname: String,
    status: String,
    last_seen: Date,
    created_at: Date,
  },
  { collection: "hvncdevices" },
);

const HVNCDevice = mongoose.model("HVNCDevice", hvncDeviceSchema);

async function checkOldDatabase() {
  try {
    console.log("🔍 Connecting to OLD database...");

    // Connect to OLD database
    await mongoose.connect(process.env.OLD_MONGO_URI);
    console.log("✅ Connected to OLD database");

    // Find all devices
    const devices = await HVNCDevice.find({});
    console.log(`\n📊 Found ${devices.length} devices in OLD database:`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    devices.forEach((device, index) => {
      console.log(`${index + 1}. Device ID: ${device.device_id}`);
      console.log(`   PC Name: ${device.pc_name}`);
      console.log(`   Hostname: ${device.hostname}`);
      console.log(`   Status: ${device.status}`);
      console.log(`   Last Seen: ${device.last_seen}`);
      console.log(`   Created: ${device.created_at}`);
      console.log("   ───────────────────────────────────");
    });

    // Check for our test device specifically
    const testDevice = await HVNCDevice.findOne({
      device_id: "DEVICE-3863CCC752739530",
    });
    if (testDevice) {
      console.log("\n🎯 Test device found:");
      console.log("   Device ID:", testDevice.device_id);
      console.log("   PC Name:", testDevice.pc_name);
      console.log("   ObjectId:", testDevice._id.toString());
      console.log("   Status:", testDevice.status);
    } else {
      console.log("\n❌ Test device DEVICE-3863CCC752739530 not found");
    }
  } catch (error) {
    console.error("❌ Error checking old database:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

checkOldDatabase();
