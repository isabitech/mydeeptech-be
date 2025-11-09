const axios = require('axios');

const testUpdateToolExperience = async () => {
    try {
        console.log('🛠️ Testing Tool Experience Update...\n');

        // Step 1: Login first to get JWT token
        const loginData = {
            email: process.env.TEST_USER_EMAIL || "test@example.com",
            password: process.env.TEST_USER_PASSWORD || "your-password-here"
        };

        if (loginData.email === "test@example.com" || loginData.password === "your-password-here") {
            console.log('❌ Please set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables');
            return;
        }

        console.log('🔐 Step 1: Logging in...');
        const loginResponse = await axios.post('http://localhost:5000/api/auth/dtUserLogin', loginData);
        
        if (!loginResponse.data.success) {
            console.log('❌ Login failed:', loginResponse.data.message);
            return;
        }

        const token = loginResponse.data._usrinfo.data;
        const userId = loginResponse.data.user.id;
        
        console.log('✅ Login successful!');
        console.log('User Status:', loginResponse.data.user.annotatorStatus);

        // Test different tool experience combinations
        const toolExperienceTests = [
            {
                name: "Single Tool",
                toolExperience: ["scale_ai"]
            },
            {
                name: "Multiple Standard Tools",
                toolExperience: ["labelbox", "scale_ai", "appen"]
            },
            {
                name: "New Tools (CVAT & E2F)",
                toolExperience: ["cvat", "e2f"]
            },
            {
                name: "Mixed Tools (Old + New)",
                toolExperience: ["labelbox", "scale_ai", "cvat", "e2f", "toloka"]
            },
            {
                name: "All Available Tools",
                toolExperience: ["labelbox", "scale_ai", "cvat", "e2f", "appen", "clickworker", "mechanical_turk", "toloka", "remotasks", "annotator_tools", "custom_platforms"]
            }
        ];

        for (let i = 0; i < toolExperienceTests.length; i++) {
            const test = toolExperienceTests[i];
            console.log(`\n📤 Test ${i + 1}: ${test.name}`);
            console.log('Tools to set:', test.toolExperience);

            try {
                const updateResponse = await axios.patch(
                    `http://localhost:5000/api/auth/dtUserProfile/${userId}`,
                    {
                        toolExperience: test.toolExperience
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log('✅ Update successful!');
                console.log('Updated Tools:', updateResponse.data.profile.toolExperience);
                console.log('Number of tools:', updateResponse.data.profile.toolExperience.length);
                
            } catch (updateError) {
                console.error('❌ Update failed:');
                if (updateError.response) {
                    console.error('Status:', updateError.response.status);
                    console.error('Error:', updateError.response.data);
                } else {
                    console.error('Error:', updateError.message);
                }
            }
            
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Test clearing tool experience
        console.log('\n📤 Test: Clearing Tool Experience');
        try {
            const clearResponse = await axios.patch(
                `http://localhost:5000/api/auth/dtUserProfile/${userId}`,
                {
                    toolExperience: []
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Clear successful!');
            console.log('Tools after clearing:', clearResponse.data.profile.toolExperience);
            
        } catch (clearError) {
            console.error('❌ Clear failed:', clearError.response?.data || clearError.message);
        }

        console.log('\n🎯 Tool Experience Update Tests Complete!');
        console.log('Available tools:');
        console.log('- labelbox');
        console.log('- scale_ai');
        console.log('- cvat (NEW)');
        console.log('- e2f (NEW)');
        console.log('- appen');
        console.log('- clickworker');
        console.log('- mechanical_turk');
        console.log('- toloka');
        console.log('- remotasks');
        console.log('- annotator_tools');
        console.log('- custom_platforms');
        
    } catch (error) {
        console.error('\n❌ Tool experience test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Run the test
testUpdateToolExperience();