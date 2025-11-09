const axios = require('axios');

const testUpdateAnnotationSkills = async () => {
    try {
        console.log('🎯 Testing Annotation Skills Update...\n');

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

        // Test different annotation skills combinations
        const annotationSkillsTests = [
            {
                name: "Single Annotation Skill",
                annotationSkills: ["text_annotation"]
            },
            {
                name: "Multiple Media Types",
                annotationSkills: ["text_annotation", "image_annotation", "video_annotation", "audio_annotation"]
            },
            {
                name: "Analysis Skills",
                annotationSkills: ["sentiment_analysis", "entity_recognition", "classification"]
            },
            {
                name: "Technical Skills",
                annotationSkills: ["object_detection", "semantic_segmentation", "transcription", "translation"]
            },
            {
                name: "Mixed Skills (Media + Analysis)",
                annotationSkills: ["text_annotation", "image_annotation", "sentiment_analysis", "classification", "object_detection"]
            },
            {
                name: "All Available Skills",
                annotationSkills: [
                    "text_annotation", 
                    "image_annotation", 
                    "video_annotation", 
                    "audio_annotation", 
                    "sentiment_analysis", 
                    "entity_recognition", 
                    "classification", 
                    "object_detection", 
                    "semantic_segmentation", 
                    "transcription", 
                    "translation", 
                    "content_moderation", 
                    "data_entry"
                ]
            }
        ];

        for (let i = 0; i < annotationSkillsTests.length; i++) {
            const test = annotationSkillsTests[i];
            console.log(`\n📤 Test ${i + 1}: ${test.name}`);
            console.log('Skills to set:', test.annotationSkills);

            try {
                const updateResponse = await axios.patch(
                    `http://localhost:5000/api/auth/dtUserProfile/${userId}`,
                    {
                        annotationSkills: test.annotationSkills
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log('✅ Update successful!');
                console.log('Updated Skills:', updateResponse.data.profile.annotationSkills);
                console.log('Number of skills:', updateResponse.data.profile.annotationSkills.length);
                
                // Group skills by category for better display
                const mediaSkills = updateResponse.data.profile.annotationSkills.filter(skill => 
                    ['text_annotation', 'image_annotation', 'video_annotation', 'audio_annotation'].includes(skill)
                );
                const analysisSkills = updateResponse.data.profile.annotationSkills.filter(skill => 
                    ['sentiment_analysis', 'entity_recognition', 'classification'].includes(skill)
                );
                const technicalSkills = updateResponse.data.profile.annotationSkills.filter(skill => 
                    ['object_detection', 'semantic_segmentation', 'transcription', 'translation', 'content_moderation', 'data_entry'].includes(skill)
                );
                
                if (mediaSkills.length > 0) console.log('  📱 Media Skills:', mediaSkills);
                if (analysisSkills.length > 0) console.log('  🧠 Analysis Skills:', analysisSkills);
                if (technicalSkills.length > 0) console.log('  ⚙️ Technical Skills:', technicalSkills);
                
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

        // Test clearing annotation skills
        console.log('\n📤 Test: Clearing Annotation Skills');
        try {
            const clearResponse = await axios.patch(
                `http://localhost:5000/api/auth/dtUserProfile/${userId}`,
                {
                    annotationSkills: []
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Clear successful!');
            console.log('Skills after clearing:', clearResponse.data.profile.annotationSkills);
            
        } catch (clearError) {
            console.error('❌ Clear failed:', clearError.response?.data || clearError.message);
        }

        console.log('\n🎯 Annotation Skills Update Tests Complete!');
        console.log('\n📋 Available annotation skills:');
        console.log('\n📱 Media Annotation:');
        console.log('- text_annotation (NEW)');
        console.log('- image_annotation (NEW)');
        console.log('- video_annotation (NEW)');
        console.log('- audio_annotation (NEW)');
        console.log('\n🧠 Analysis Skills:');
        console.log('- sentiment_analysis');
        console.log('- entity_recognition');
        console.log('- classification');
        console.log('\n⚙️ Technical Skills:');
        console.log('- object_detection');
        console.log('- semantic_segmentation');
        console.log('- transcription');
        console.log('- translation');
        console.log('- content_moderation');
        console.log('- data_entry');
        
    } catch (error) {
        console.error('\n❌ Annotation skills test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Run the test
testUpdateAnnotationSkills();