const axios = require('axios');

const testAdminFunctions = async () => {
    try {
        console.log('👑 Testing Admin Functions...\n');

        // Step 1: Admin login (use an admin email)
        const adminLoginData = {
            email: process.env.ADMIN_EMAIL || "admin@mydeeptech.ng", // Use admin email
            password: process.env.ADMIN_PASSWORD || "your-admin-password"
        };

        // Security check for admin credentials
        if (adminLoginData.email === "admin@mydeeptech.ng" || adminLoginData.password === "your-admin-password") {
            console.log('❌ Please set ADMIN_EMAIL and ADMIN_PASSWORD environment variables');
            console.log('Example: set ADMIN_EMAIL=admin@mydeeptech.ng');
            console.log('Example: set ADMIN_PASSWORD=your-admin-password');
            console.log('\n💡 Note: Admin emails should end with @mydeeptech.ng or be listed in ADMIN_EMAILS env var');
            return;
        }

        console.log('🔐 Step 1: Admin login...');
        const loginResponse = await axios.post('http://localhost:5000/api/auth/dtUserLogin', adminLoginData);
        
        if (!loginResponse.data.success) {
            console.log('❌ Admin login failed:', loginResponse.data.message);
            return;
        }

        const adminToken = loginResponse.data._usrinfo.data;
        const adminId = loginResponse.data.user.id;
        
        console.log('✅ Admin login successful!');
        console.log('Admin Email:', loginResponse.data.user.email);
        console.log('Admin ID:', adminId);

        // Step 2: Get all DTUsers
        console.log('\n📊 Step 2: Getting all DTUsers...');
        
        try {
            const allUsersResponse = await axios.get(
                'http://localhost:5000/api/admin/dtusers',
                {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ All DTUsers retrieved successfully!');
            console.log('Total Users:', allUsersResponse.data.data.summary.totalUsers);
            console.log('Status Breakdown:', allUsersResponse.data.data.summary.statusBreakdown);
            console.log('Current Page:', allUsersResponse.data.data.pagination.currentPage);
            console.log('Total Pages:', allUsersResponse.data.data.pagination.totalPages);
            
            console.log('\n👥 Sample Users:');
            allUsersResponse.data.data.users.slice(0, 3).forEach((user, index) => {
                console.log(`${index + 1}. ${user.fullName} (${user.email}) - Status: ${user.annotatorStatus}`);
            });

            // Step 3: Test filtering
            console.log('\n🔍 Step 3: Testing filtered queries...');
            
            // Filter by status
            const pendingUsersResponse = await axios.get(
                'http://localhost:5000/api/admin/dtusers?status=pending&limit=5',
                {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ Pending users filtered:');
            console.log('Pending Users Count:', pendingUsersResponse.data.data.users.length);
            
            // Step 4: Get specific user details
            if (allUsersResponse.data.data.users.length > 0) {
                const firstUserId = allUsersResponse.data.data.users[0]._id;
                console.log('\n👤 Step 4: Getting specific user details...');
                
                const userDetailsResponse = await axios.get(
                    `http://localhost:5000/api/admin/dtusers/${firstUserId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${adminToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                console.log('✅ User details retrieved:');
                console.log('User:', userDetailsResponse.data.data.user.fullName);
                console.log('Email:', userDetailsResponse.data.data.user.email);
                console.log('Current Status:', userDetailsResponse.data.data.user.annotatorStatus);
                console.log('Email Verified:', userDetailsResponse.data.data.user.isEmailVerified);
                console.log('Password Set:', userDetailsResponse.data.data.user.hasSetPassword);

                // Step 5: Test approve annotator (only if user is not already approved)
                const currentUser = userDetailsResponse.data.data.user;
                if (currentUser.annotatorStatus !== 'approved') {
                    console.log('\n✅ Step 5: Testing annotator approval...');
                    
                    const approveResponse = await axios.patch(
                        `http://localhost:5000/api/admin/dtusers/${firstUserId}/approve`,
                        {
                            newStatus: 'verified' // or 'approved'
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${adminToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    console.log('✅ Annotator status updated successfully!');
                    console.log('Previous Status:', approveResponse.data.data.previousStatus);
                    console.log('New Status:', approveResponse.data.data.newStatus);
                    console.log('Updated By:', approveResponse.data.data.updatedBy);
                    console.log('User:', approveResponse.data.data.fullName);
                } else {
                    console.log('\n💡 Step 5: User already approved, skipping approval test');
                }
            }

        } catch (adminError) {
            console.error('\n❌ Admin function failed:');
            if (adminError.response) {
                console.error('Status:', adminError.response.status);
                console.error('Response:', adminError.response.data);
                
                if (adminError.response.status === 403) {
                    console.log('\n💡 Admin Access Denied. Possible reasons:');
                    console.log('1. Email does not end with @mydeeptech.ng');
                    console.log('2. Email not listed in ADMIN_EMAILS environment variable');
                    console.log('3. User does not have admin privileges');
                }
            } else {
                console.error('Error:', adminError.message);
            }
        }

        console.log('\n🎯 Admin functionality tests completed!');
        
    } catch (error) {
        console.error('\n❌ Admin test failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Run the test
testAdminFunctions();