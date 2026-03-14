const mongoose = require("mongoose");
require("dotenv").config();

// HVNC Device Schema
const hvncDeviceSchema = new mongoose.Schema(
  {
    device_id: { type: String, required: true, unique: true },
    pc_name: { type: String, required: true },
    hostname: { type: String },
    ip_address: { type: String },
    operating_system: { type: String },
    processor: { type: String },
    memory: { type: String },
    graphics_card: { type: String },
    screen_resolution: { type: String },
    location: {
      country: { type: String },
      region: { type: String },
      city: { type: String },
      timezone: { type: String },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
    },
    specifications: {
      cpu_usage: { type: Number },
      memory_usage: { type: Number },
      disk_usage: { type: Number },
      network_speed: { type: String },
      uptime: { type: String },
    },
    status: {
      type: String,
      enum: ["online", "offline", "disabled", "maintenance"],
      default: "offline",
    },
    last_seen: { type: Date },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: "hvncdevices" },
);

async function migrateTestDevice() {
  try {
    console.log("🔄 Starting device migration...");

    // Connect to OLD database to get device data
    console.log("🔍 Connecting to OLD database...");
    const oldConnection = await mongoose.createConnection(
      process.env.OLD_MONGO_URI,
    );
    console.log("✅ Connected to OLD database");

    const OldHVNCDevice = oldConnection.model("HVNCDevice", hvncDeviceSchema);

    // Find the test device in old DB
    const testDevice = await OldHVNCDevice.findOne({
      device_id: "DEVICE-3863CCC752739530",
    });

    if (!testDevice) {
      console.log("❌ Test device not found in OLD database");
      await oldConnection.close();
      return;
    }

    console.log("🎯 Found test device in OLD database:");
    console.log("   Device ID:", testDevice.device_id);
    console.log("   PC Name:", testDevice.pc_name);
    console.log("   ObjectId:", testDevice._id.toString());
    console.log("   Status:", testDevice.status);

    // Close old connection
    await oldConnection.close();

    // Connect to NEW database
    console.log("\\n🔍 Connecting to NEW database...");
    const newConnection = await mongoose.createConnection(
      process.env.MONGO_URI,
    );
    console.log("✅ Connected to NEW database");

    const NewHVNCDevice = newConnection.model("HVNCDevice", hvncDeviceSchema);

    // Check if device already exists in new DB
    const existingDevice = await NewHVNCDevice.findOne({
      device_id: testDevice.device_id,
    });

    if (existingDevice) {
      console.log("ℹ️  Device already exists in NEW database, updating...");

      // Update the device
      await NewHVNCDevice.findOneAndUpdate(
        { device_id: testDevice.device_id },
        {
          pc_name: testDevice.pc_name,
          hostname: testDevice.hostname,
          status: "offline",
          last_seen: new Date(),
          updated_at: new Date(),
        },
      );

      console.log("✅ Device updated in NEW database");
    } else {
      console.log("📝 Creating device in NEW database...");

      // Create new device (preserve original _id for token compatibility)
      const newDevice = new NewHVNCDevice({
        _id: testDevice._id, // Preserve original ObjectId for token compatibility
        device_id: testDevice.device_id,
        pc_name: testDevice.pc_name,
        hostname: testDevice.hostname,
        ip_address: testDevice.ip_address,
        operating_system: testDevice.operating_system,
        processor: testDevice.processor,
        memory: testDevice.memory,
        graphics_card: testDevice.graphics_card,
        screen_resolution: testDevice.screen_resolution,
        location: testDevice.location,
        specifications: testDevice.specifications,
        status: "offline",
        last_seen: new Date(),
        created_at: testDevice.created_at || new Date(),
        updated_at: new Date(),
      });

      await newDevice.save();
      console.log("✅ Device created in NEW database");
    }

    // Verify device in new DB
    const verifyDevice = await NewHVNCDevice.findOne({
      device_id: testDevice.device_id,
    });
    if (verifyDevice) {
      console.log("\\n🔍 Verification - Device found in NEW database:");
      console.log("   Device ID:", verifyDevice.device_id);
      console.log("   PC Name:", verifyDevice.pc_name);
      console.log("   ObjectId:", verifyDevice._id.toString());
      console.log("   Status:", verifyDevice.status);
    }

    await newConnection.close();
    console.log("\\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration error:", error.message);
  }
}

migrateTestDevice();
