const HVNCUser = require('../models/hvnc-user.model');
const HVNCDevice = require('../models/hvnc-device.model');
const emailService = require('../services/hvnc-email.service');

async function debugEmailRequest() {
  try {
    console.log('🔍 Debug: Testing exact email flow from controller...\n');

    // Test data (replace with your actual email and device)
    const email = 'dammykolaceo@gmail.com';  // Replace with your email
    const deviceId = 'CEO';  // Replace with your device ID

    console.log('📋 Request Parameters:');
    console.log('   Email:', email);
    console.log('   Device ID:', deviceId);

    // Find the user (same as controller)
    console.log('\n🔍 Finding user...');
    const user = await HVNCUser.findByEmail(email);
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    console.log('✅ User found:', user.full_name);

    // Find the device (same as controller)
    console.log('\n🔍 Finding device...');
    const device = await HVNCDevice.findByDeviceId(deviceId);
    if (!device) {
      console.log('❌ Device not found!');
      return;
    }
    console.log('✅ Device found:', device.pc_name);

    // Generate code (same as controller)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('\n🔢 Generated access code:', code);

    // Calculate expiry (same as controller)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    console.log('⏰ Expires at:', expiresAt.toLocaleString());

    // Send email (same as controller)
    console.log('\n📧 Sending email with exact controller parameters...');
    console.log('   User object:', {
      id: user._id,
      email: user.email,
      fullName: user.full_name,
      role: user.role
    });
    console.log('   Device object:', {
      id: device._id,
      deviceId: device.device_id,
      pcName: device.pc_name
    });
    console.log('   Code:', code);
    console.log('   ExpiresAt:', expiresAt);

    await emailService.sendAccessCode(user, device, code, expiresAt);
    
    console.log('✅ Email sent successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Check your email inbox');
    console.log('   2. Check spam folder if not in inbox');
    console.log('   3. If still no email, we may have a delivery issue');

  } catch (error) {
    console.error('❌ Debug test failed:', error);
  } finally {
    process.exit();
  }
}

// Run the debug test
debugEmailRequest();