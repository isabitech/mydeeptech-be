const axios = require('axios');

const testUpdateDTUserProfile = async () => {
    try {
        console.log('📝 Testing DTUser Profile Update with JWT Authentication...\n');

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

        const token = loginResponse.data._usrinfo.data;
        const userId = loginResponse.data.user.id;
        
        console.log('✅ Login successful!');
        console.log('User ID:', userId);
        console.log('Current Status:', loginResponse.data.user.annotatorStatus);

        // Step 2: Test profile update
        console.log('\n📤 Step 2: Testing profile update...');
        
        // Sample update data
        const updateData = {
            personalInfo: {
                country: "Nigeria",
                timeZone: "Africa/Lagos",
                availableHoursPerWeek: 25,
                preferredCommunicationChannel: "email"
            },
            paymentInfo: {
                accountName: "John Doe",
                paymentMethod: "bank_transfer",
                paymentCurrency: "NGN"
            },
            professionalBackground: {
                educationField: "Computer Science",
                yearsOfExperience: 3,
                annotationExperienceTypes: ["text_annotation", "data_labeling"]
            },
            toolExperience: ["labelbox", "scale_ai", "cvat", "e2f"],
            annotationSkills: ["text_annotation", "image_annotation", "sentiment_analysis", "classification"],
            languageProficiency: {
                primaryLanguage: "English",
                otherLanguages: ["Yoruba", "French"],
                englishFluencyLevel: "native"
            },
            systemInfo: {
                deviceType: "laptop",
                operatingSystem: "windows",
                internetSpeedMbps: 50,
                powerBackup: true,
                hasWebcam: true,
                hasMicrophone: true
            },
            projectPreferences: {
                domainsOfInterest: ["AI", "Natural Language Processing", "Data Science"],
                availabilityType: "part_time",
                ndaSigned: true
            }
        };

        try {
            const updateResponse = await axios.patch(
                `http://localhost:5000/api/auth/dtUserProfile/${userId}`,
                updateData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('\n✅ Profile Update Response:');
            console.log('Status:', updateResponse.status);
            console.log('Success:', updateResponse.data.success);
            console.log('Message:', updateResponse.data.message);
            console.log('Fields Updated:', updateResponse.data.fieldsUpdated);
            
            const updatedProfile = updateResponse.data.profile;
            
            console.log('\n📊 Updated Profile Data:');
            console.log('📍 Personal Info:');
            console.log('  Country:', updatedProfile.personalInfo.country);
            console.log('  Time Zone:', updatedProfile.personalInfo.timeZone);
            console.log('  Available Hours/Week:', updatedProfile.personalInfo.availableHoursPerWeek);
            console.log('  Preferred Communication:', updatedProfile.personalInfo.preferredCommunicationChannel);
            
            console.log('\n💳 Payment Info:');
            console.log('  Account Name:', updatedProfile.paymentInfo.accountName);
            console.log('  Payment Method:', updatedProfile.paymentInfo.paymentMethod);
            console.log('  Currency:', updatedProfile.paymentInfo.paymentCurrency);
            
            console.log('\n🎓 Professional Background:');
            console.log('  Education Field:', updatedProfile.professionalBackground.educationField);
            console.log('  Years of Experience:', updatedProfile.professionalBackground.yearsOfExperience);
            console.log('  Annotation Experience:', updatedProfile.professionalBackground.annotationExperienceTypes);
            
            console.log('\n🛠️ Technical Skills:');
            console.log('  Tool Experience:', updatedProfile.toolExperience);
            console.log('  Annotation Skills:', updatedProfile.annotationSkills);
            
            console.log('\n🌐 Language Proficiency:');
            console.log('  Primary Language:', updatedProfile.languageProficiency.primaryLanguage);
            console.log('  Other Languages:', updatedProfile.languageProficiency.otherLanguages);
            console.log('  English Fluency:', updatedProfile.languageProficiency.englishFluencyLevel);
            
            console.log('\n💻 System Info:');
            console.log('  Device Type:', updatedProfile.systemInfo.deviceType);
            console.log('  Operating System:', updatedProfile.systemInfo.operatingSystem);
            console.log('  Internet Speed:', updatedProfile.systemInfo.internetSpeedMbps + ' Mbps');
            console.log('  Power Backup:', updatedProfile.systemInfo.powerBackup);
            console.log('  Has Webcam:', updatedProfile.systemInfo.hasWebcam);
            console.log('  Has Microphone:', updatedProfile.systemInfo.hasMicrophone);
            
            console.log('\n📁 Project Preferences:');
            console.log('  Domains of Interest:', updatedProfile.projectPreferences.domainsOfInterest);
            console.log('  Availability Type:', updatedProfile.projectPreferences.availabilityType);
            console.log('  NDA Signed:', updatedProfile.projectPreferences.ndaSigned);
            
        } catch (updateError) {
            console.error('\n❌ Profile update failed:');
            if (updateError.response) {
                console.error('Status:', updateError.response.status);
                console.error('Response:', updateError.response.data);
                
                if (updateError.response.status === 403) {
                    console.log('\n💡 Note: Profile updates require annotator status to be "verified" or "approved"');
                    console.log('Current status:', loginResponse.data.user.annotatorStatus);
                }
            } else {
                console.error('Error:', updateError.message);
            }
        }

        // Step 3: Test partial update
        console.log('\n📤 Step 3: Testing partial profile update...');
        
        const partialUpdateData = {
            personalInfo: {
                availableHoursPerWeek: 30
            },
            systemInfo: {
                internetSpeedMbps: 100
            }
        };

        try {
            const partialUpdateResponse = await axios.patch(
                `http://localhost:5000/api/auth/dtUserProfile/${userId}`,
                partialUpdateData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Partial update successful!');
            console.log('Fields Updated:', partialUpdateResponse.data.fieldsUpdated);
            console.log('New Available Hours:', partialUpdateResponse.data.profile.personalInfo.availableHoursPerWeek);
            console.log('New Internet Speed:', partialUpdateResponse.data.profile.systemInfo.internetSpeedMbps);
            
        } catch (partialError) {
            console.error('❌ Partial update failed:', partialError.response?.data || partialError.message);
        }
        
    } catch (error) {
        console.error('\n❌ Profile update test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Run the test
testUpdateDTUserProfile();