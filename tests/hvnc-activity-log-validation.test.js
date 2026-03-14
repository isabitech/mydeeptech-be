/**
 * Test suite for HVNCActivityLog validation - specifically testing enum validation
 * This test verifies the fix for ValidationError with invalid event_type values
 */

const mongoose = require("mongoose");
const HVNCActivityLog = require("../models/hvnc-activity-log.model");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

describe("HVNCActivityLog Event Type Validation", () => {
  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect("mongodb://localhost:27017/hvnc_test", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  });

  afterAll(async () => {
    // Clean up test data and close connection
    await HVNCActivityLog.deleteMany({});
    await mongoose.connection.close();
  });

  describe("Invalid Event Types", () => {
    test('should reject "device_connected" as invalid enum value', async () => {
      const invalidLog = new HVNCActivityLog({
        device_id: "DEVICE-TEST-001",
        event_type: "device_connected", // This should fail
        event_data: {
          test: "data",
        },
      });

      await expect(invalidLog.validate()).rejects.toMatchObject({
        errors: {
          event_type: expect.objectContaining({
            message: expect.stringContaining("device_connected"),
            kind: "enum",
          }),
        },
      });
    });

    test("should reject other invalid event types", async () => {
      const invalidEventTypes = [
        "device_connected",
        "invalid_event",
        "random_string",
        "device_connection_established",
        "",
      ];

      for (const eventType of invalidEventTypes) {
        const invalidLog = new HVNCActivityLog({
          device_id: "DEVICE-TEST-001",
          event_type: eventType,
          event_data: {},
        });

        await expect(invalidLog.validate()).rejects.toHaveProperty(
          "errors.event_type",
        );
      }
    });
  });

  describe("Valid Event Types", () => {
    test('should accept "device_online" as valid enum value', async () => {
      const validLog = new HVNCActivityLog({
        device_id: "DEVICE-TEST-001",
        event_type: "device_online", // This should pass
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

      // Should not throw any validation errors
      await expect(validLog.validate()).resolves.toBeUndefined();

      // Should be able to save successfully
      const savedLog = await validLog.save();
      expect(savedLog.event_type).toBe("device_online");
    });

    test("should accept all valid device-related event types", async () => {
      const validDeviceEvents = [
        "device_online",
        "device_offline",
        "device_disconnected",
        "device_reconnected",
        "device_registration",
        "device_heartbeat",
        "device_disabled",
      ];

      for (const eventType of validDeviceEvents) {
        const validLog = new HVNCActivityLog({
          device_id: `DEVICE-TEST-${eventType}`,
          event_type: eventType,
          event_data: { test: "data" },
        });

        await expect(validLog.validate()).resolves.toBeUndefined();
        const saved = await validLog.save();
        expect(saved.event_type).toBe(eventType);
      }
    });
  });

  describe("WebSocket Service Integration", () => {
    test("should verify WebSocket service uses correct event types", () => {
      const websocketServicePath = path.join(
        __dirname,
        "../services/hvnc-websocket.service.js",
      );
      const serviceContent = fs.readFileSync(websocketServicePath, "utf8");

      // Verify the service doesn't use the invalid "device_connected" anymore
      expect(serviceContent).not.toContain('"device_connected"');
      expect(serviceContent).not.toContain("'device_connected'");

      // Verify it uses the correct "device_online" instead
      expect(serviceContent).toContain('"device_online"');
    });

    test("should check for any remaining invalid enum usage in codebase", () => {
      try {
        // Search for any remaining instances of device_connected in JS files
        const searchCommand =
          process.platform === "win32"
            ? 'findstr /r /s "device_connected" *.js'
            : 'grep -r "device_connected" --include="*.js" .';

        const result = execSync(searchCommand, {
          cwd: path.join(__dirname, ".."),
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"], // Ignore stderr to prevent noise
        });

        // If we get results, it means device_connected is still being used somewhere
        if (result.trim()) {
          console.warn("Found remaining instances of device_connected:");
          console.warn(result);
          fail(
            'Found remaining instances of invalid "device_connected" event type in codebase',
          );
        }
      } catch (error) {
        // If grep/findstr returns non-zero (no matches found), that's what we want
        if (error.status === 1) {
          // No matches found - this is good!
          expect(true).toBe(true);
        } else {
          // Some other error occurred
          throw error;
        }
      }
    });
  });

  describe("HVNCActivityLog.logDeviceEvent Method", () => {
    test("should successfully log device online event", async () => {
      // Test the static method directly
      await HVNCActivityLog.logDeviceEvent(
        "DEVICE-TEST-METHOD",
        "device_online",
        {
          socket_id: "test-socket-456",
          connection_type: "websocket",
          pc_name: "Test PC Method",
        },
        {
          status: "success",
          ip_address: "192.168.1.100",
        },
      );

      // Verify the log was created correctly
      const createdLog = await HVNCActivityLog.findOne({
        device_id: "DEVICE-TEST-METHOD",
        event_type: "device_online",
      });

      expect(createdLog).toBeTruthy();
      expect(createdLog.event_type).toBe("device_online");
      expect(createdLog.event_data.pc_name).toBe("Test PC Method");
    });

    test("should fail when trying to log with invalid event type", async () => {
      // This should throw a validation error
      await expect(
        HVNCActivityLog.logDeviceEvent(
          "DEVICE-TEST-INVALID",
          "device_connected", // Invalid enum value
          { test: "data" },
          { status: "success" },
        ),
      ).rejects.toThrow(/validation failed/i);
    });
  });
});

describe("Device Connection Flow Validation", () => {
  test("should simulate complete device connection flow with correct event types", async () => {
    const deviceId = "DEVICE-FLOW-TEST";

    // 1. Device registration
    await HVNCActivityLog.logDeviceEvent(deviceId, "device_registration", {
      pc_name: "Flow Test PC",
    });

    // 2. Device comes online (NOT device_connected)
    await HVNCActivityLog.logDeviceEvent(deviceId, "device_online", {
      socket_id: "flow-socket-123",
      connection_type: "websocket",
    });

    // 3. Device sends heartbeat
    await HVNCActivityLog.logDeviceEvent(deviceId, "device_heartbeat", {
      timestamp: new Date(),
    });

    // 4. Device goes offline
    await HVNCActivityLog.logDeviceEvent(deviceId, "device_offline", {
      reason: "connection_lost",
    });

    // Verify all events were logged correctly
    const logs = await HVNCActivityLog.find({ device_id: deviceId }).sort({
      created_at: 1,
    });
    expect(logs).toHaveLength(4);
    expect(logs[0].event_type).toBe("device_registration");
    expect(logs[1].event_type).toBe("device_online");
    expect(logs[2].event_type).toBe("device_heartbeat");
    expect(logs[3].event_type).toBe("device_offline");
  });
});

// Export for potential use in other test files
module.exports = {
  validDeviceEventTypes: [
    "device_registration",
    "device_heartbeat",
    "device_online",
    "device_offline",
    "device_disconnected",
    "device_reconnected",
    "device_disabled",
  ],
  invalidEventTypes: [
    "device_connected",
    "device_connection_established",
    "invalid_event",
  ],
};
