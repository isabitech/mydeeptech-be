const axios = require('axios');

const testGetDTUserProfile = async () => {
    try {
        console.log('📋 Testing DTUser Profile Retrieval with JWT Authentication...\n');

        // Step 1: Login first to get JWT token
        const loginData = {
            email: process.env.TEST_USER_EMAIL || "test@example.com",
            password: process.env.TEST_USER_PASSWORD || "your-password-here"
        };

        // Security check for login credentials
        if (loginData.email === "test@example.com" || loginData.password === "your-password-here") {
            console.log('❌ Please set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables');
            console.log('Example: set TEST_USER_EMAIL=your-email@example.com');
            console.log('Example: set TEST_USER_PASSWORD=your-actual-password');
            return;
        }

        console.log('🔐 Step 1: Logging in to get JWT token...');
        const loginResponse = await axios.post('http://localhost:5000/api/auth/dtUserLogin', loginData);
        
        if (!loginResponse.data.success) {
            console.log('❌ Login failed:', loginResponse.data.message);
            return;
        }

        const token = loginResponse.data._usrinfo.data; // Get token from _usrinfo.data format
        const userId = loginResponse.data.user.id;
        
        console.log('✅ Login successful!');
        console.log('User ID:', userId);
        console.log('Token length:', token.length);

        // Step 2: Use the token to fetch profile
        console.log('\n📤 Step 2: Fetching profile with JWT token...');
        
        const profileResponse = await axios.get(
            `http://localhost:5000/api/auth/dtUserProfile/${userId}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('\n✅ Profile Response:');
        console.log('Status:', profileResponse.status);
        console.log('Success:', profileResponse.data.success);
        console.log('Message:', profileResponse.data.message);
        
        const profile = profileResponse.data.profile;
        
        console.log('\n🆔 Basic User Info:');
        console.log('ID:', profile.id);
        console.log('Full Name:', profile.fullName);
        console.log('Email:', profile.email);
        console.log('Phone:', profile.phone);
        console.log('Domains:', profile.domains);
        console.log('Consent:', profile.consent);
        console.log('Annotator Status:', profile.annotatorStatus);
        console.log('MicroTasker Status:', profile.microTaskerStatus);
        console.log('Email Verified:', profile.isEmailVerified);
        console.log('Password Set:', profile.hasSetPassword);
        
        console.log('\n👤 Personal Info:');
        console.log('Full Name:', profile.personalInfo.fullName);
        console.log('Email:', profile.personalInfo.email);
        console.log('Phone:', profile.personalInfo.phoneNumber);
        console.log('Country:', profile.personalInfo.country || 'Not set');
        console.log('Time Zone:', profile.personalInfo.timeZone || 'Not set');
        console.log('Available Hours/Week:', profile.personalInfo.availableHoursPerWeek);
        console.log('Preferred Communication:', profile.personalInfo.preferredCommunicationChannel || 'Not set');
        
        console.log('\n💳 Payment Info:');
        console.log('Account Name:', profile.paymentInfo.accountName || 'Not set');
        console.log('Payment Method:', profile.paymentInfo.paymentMethod || 'Not set');
        console.log('Payment Currency:', profile.paymentInfo.paymentCurrency || 'Not set');
        
        console.log('\n🎓 Professional Background:');
        console.log('Education Field:', profile.professionalBackground.educationField || 'Not set');
        console.log('Years of Experience:', profile.professionalBackground.yearsOfExperience);
        console.log('Annotation Experience:', profile.professionalBackground.annotationExperienceTypes);
        
        console.log('\n🛠️ Technical Skills:');
        console.log('Tool Experience:', profile.toolExperience);
        console.log('Annotation Skills:', profile.annotationSkills);
        
        console.log('\n🌐 Language Proficiency:');
        console.log('Primary Language:', profile.languageProficiency.primaryLanguage || 'Not set');
        console.log('Other Languages:', profile.languageProficiency.otherLanguages);
        console.log('English Fluency:', profile.languageProficiency.englishFluencyLevel || 'Not set');
        
        console.log('\n💻 System Info:');
        console.log('Device Type:', profile.systemInfo.deviceType || 'Not set');
        console.log('Operating System:', profile.systemInfo.operatingSystem || 'Not set');
        console.log('Internet Speed (Mbps):', profile.systemInfo.internetSpeedMbps);
        console.log('Power Backup:', profile.systemInfo.powerBackup);
        console.log('Has Webcam:', profile.systemInfo.hasWebcam);
        console.log('Has Microphone:', profile.systemInfo.hasMicrophone);
        
        console.log('\n📁 Project Preferences:');
        console.log('Domains of Interest:', profile.projectPreferences.domainsOfInterest);
        console.log('Availability Type:', profile.projectPreferences.availabilityType || 'Not set');
        console.log('NDA Signed:', profile.projectPreferences.ndaSigned);
        
        console.log('\n📎 Attachments:');
        console.log('Resume URL:', profile.attachments.resumeUrl || 'Not uploaded');
        console.log('ID Document URL:', profile.attachments.idDocumentUrl || 'Not uploaded');
        console.log('Work Samples:', profile.attachments.workSamplesUrl);
        
        console.log('\n📊 Account Metadata:');
        console.log('Created At:', new Date(profile.accountMetadata.createdAt).toLocaleString());
        console.log('Updated At:', new Date(profile.accountMetadata.updatedAt).toLocaleString());
        console.log('Status:', profile.accountMetadata.status);
        console.log('Email Verified:', profile.accountMetadata.isEmailVerified);
        console.log('Password Set:', profile.accountMetadata.hasSetPassword);
        
    } catch (error) {
        console.error('\n❌ Profile fetch test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Run the test
testGetDTUserProfile();