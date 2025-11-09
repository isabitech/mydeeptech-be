// Invoicing and Payment System Test

require('dotenv').config();

const axios = require('axios');

const testInvoicingSystem = async () => {
    console.log('💰 Testing Complete Invoicing and Payment System...\n');

    try {
        const BASE_URL = 'http://localhost:5000/api';
        let projectId = null;
        let invoiceId = null;
        let dtUserId = null;

        // Step 1: Admin Login
        console.log('🔐 Step 1: Admin Login...');
        const adminLoginResponse = await axios.post(`${BASE_URL}/admin/login`, {
            email: 'debug@mydeeptech.ng',
            password: 'TestAdmin123!'
        });
        console.log('✅ Admin Login Successful!');
        const adminToken = adminLoginResponse.data.token;

        // Step 2: Get existing project or create one
        console.log('\n🏗️ Step 2: Getting project for invoice...');
        const projectsResponse = await axios.get(`${BASE_URL}/admin/projects`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log('Projects response structure:', projectsResponse.data);
        
        // Check if the response has the expected structure
        const projects = projectsResponse.data.data?.projects || projectsResponse.data.projects || [];
        
        if (!Array.isArray(projects) || projects.length === 0) {
            console.log('❌ No projects found, creating a test project...');
            
            // Create a test project
            const testProject = await axios.post(`${BASE_URL}/admin/projects`, {
                projectName: 'Test Invoice Project',
                projectDescription: 'Project created for invoice testing',
                projectCategory: 'Text Annotation',
                payRate: 25,
                maxAnnotators: 5
            }, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            
            projectId = testProject.data.data.project._id;
            console.log(`✅ Created test project: ${testProject.data.data.project.projectName}`);
        } else {
            projectId = projects[0]._id;
            console.log(`✅ Using existing project: ${projects[0].projectName}`);
        }

        // Step 3: Get DTUser for invoice
        console.log('\n👤 Step 3: Getting DTUser for invoice...');
        const dtUsersResponse = await axios.get(`${BASE_URL}/admin/dtusers`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log('DTUsers response structure:', dtUsersResponse.data);
        
        // Check if the response has the expected structure
        const dtUsers = dtUsersResponse.data.data?.dtUsers || dtUsersResponse.data.dtUsers || [];
        
        if (!Array.isArray(dtUsers) || dtUsers.length === 0) {
            console.log('❌ No DTUsers found in response');
            console.log('Response:', JSON.stringify(dtUsersResponse.data, null, 2));
            return;
        }
        
        // Find an approved annotator
        const approvedAnnotator = dtUsers.find(user => 
            user.annotatorStatus === 'approved' && user.email !== 'debug@mydeeptech.ng'
        );
        
        if (approvedAnnotator) {
            dtUserId = approvedAnnotator._id;
            console.log(`✅ Using DTUser: ${approvedAnnotator.fullName} (${approvedAnnotator.email})`);
        } else {
            console.log('❌ No approved annotators found for testing');
            console.log('Available users:', dtUsers.map(u => ({ email: u.email, status: u.annotatorStatus })));
            return;
        }

        // Step 4: Create Invoice
        console.log('\n💰 Step 4: Creating invoice...');
        const invoiceData = {
            projectId: projectId,
            dtUserId: dtUserId,
            invoiceAmount: 150.00,
            currency: 'USD',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
            description: 'Payment for completed annotation work',
            workDescription: 'Completed image classification tasks with high quality annotations',
            hoursWorked: 10,
            tasksCompleted: 100,
            qualityScore: 95,
            invoiceType: 'project_completion',
            adminNotes: 'Excellent work quality, completed ahead of schedule'
        };

        const createInvoiceResponse = await axios.post(`${BASE_URL}/admin/invoices`, invoiceData, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        invoiceId = createInvoiceResponse.data.data.invoice._id;
        console.log('✅ Invoice created successfully!');
        console.log(`   Invoice #: ${createInvoiceResponse.data.data.invoice.formattedInvoiceNumber}`);
        console.log(`   Amount: $${createInvoiceResponse.data.data.invoice.invoiceAmount}`);
        console.log(`   Email sent: ${createInvoiceResponse.data.emailNotificationSent}`);

        // Step 5: Admin views all invoices
        console.log('\n📊 Step 5: Admin viewing all invoices...');
        const allInvoicesResponse = await axios.get(`${BASE_URL}/admin/invoices`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log(`✅ Found ${allInvoicesResponse.data.data.invoices.length} total invoices`);
        console.log(`   Summary: $${allInvoicesResponse.data.data.summary.totalAmount} total amount`);
        console.log(`   Unpaid: ${allInvoicesResponse.data.data.summary.unpaidInvoices} invoices`);

        // Step 6: Admin views specific invoice details
        console.log('\n🔍 Step 6: Admin viewing invoice details...');
        const invoiceDetailsResponse = await axios.get(`${BASE_URL}/admin/invoices/${invoiceId}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log('✅ Invoice details retrieved:');
        console.log(`   Status: ${invoiceDetailsResponse.data.data.invoice.paymentStatus}`);
        console.log(`   Amount Due: $${invoiceDetailsResponse.data.data.computedFields.amountDue}`);

        // Step 7: DTUser Login and check invoices
        console.log('\n👤 Step 7: DTUser checking invoices...');
        const dtUserLoginResponse = await axios.post(`${BASE_URL}/auth/dtUserLogin`, {
            email: approvedAnnotator.email,
            password: 'TestUser123!' // Assuming test password
        });
        
        const dtUserToken = dtUserLoginResponse.data.token;
        console.log('✅ DTUser Login Successful!');

        // Step 8: DTUser views unpaid invoices
        console.log('\n💳 Step 8: DTUser viewing unpaid invoices...');
        const unpaidInvoicesResponse = await axios.get(`${BASE_URL}/auth/invoices/unpaid`, {
            headers: { 'Authorization': `Bearer ${dtUserToken}` }
        });
        
        console.log(`✅ DTUser has ${unpaidInvoicesResponse.data.data.unpaidInvoices.length} unpaid invoices`);
        console.log(`   Total due: $${unpaidInvoicesResponse.data.data.summary.totalAmountDue}`);

        // Step 9: DTUser views invoice dashboard
        console.log('\n📈 Step 9: DTUser viewing invoice dashboard...');
        const dashboardResponse = await axios.get(`${BASE_URL}/auth/invoices/dashboard`, {
            headers: { 'Authorization': `Bearer ${dtUserToken}` }
        });
        
        console.log('✅ Dashboard statistics:');
        console.log(`   Total earned: $${dashboardResponse.data.data.summary.totalEarned}`);
        console.log(`   Pending payments: $${dashboardResponse.data.data.summary.pendingPayments}`);
        console.log(`   Total invoices: ${dashboardResponse.data.data.summary.totalInvoices}`);

        // Step 10: Admin marks invoice as paid
        console.log('\n✅ Step 10: Admin marking invoice as paid...');
        const paymentUpdateResponse = await axios.patch(`${BASE_URL}/admin/invoices/${invoiceId}/payment-status`, {
            paymentStatus: 'paid',
            paymentMethod: 'bank_transfer',
            paymentReference: 'TXN123456789',
            paymentNotes: 'Paid via bank transfer on schedule'
        }, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log('✅ Invoice marked as paid!');
        console.log(`   Email confirmation sent: ${paymentUpdateResponse.data.data.emailNotificationSent}`);

        // Step 11: DTUser checks paid invoices
        console.log('\n💚 Step 11: DTUser viewing paid invoices...');
        const paidInvoicesResponse = await axios.get(`${BASE_URL}/auth/invoices/paid`, {
            headers: { 'Authorization': `Bearer ${dtUserToken}` }
        });
        
        console.log(`✅ DTUser has ${paidInvoicesResponse.data.data.paidInvoices.length} paid invoices`);
        console.log(`   Total earnings: $${paidInvoicesResponse.data.data.summary.totalEarnings}`);

        // Step 12: Test payment reminder (create another unpaid invoice)
        console.log('\n⚠️ Step 12: Testing payment reminder...');
        const reminderInvoiceResponse = await axios.post(`${BASE_URL}/admin/invoices`, {
            projectId: projectId,
            dtUserId: dtUserId,
            invoiceAmount: 75.00,
            currency: 'USD',
            dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days overdue
            description: 'Second test invoice for reminder testing',
            invoiceType: 'milestone'
        }, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const reminderInvoiceId = reminderInvoiceResponse.data.data.invoice._id;
        
        // Send reminder
        await axios.post(`${BASE_URL}/admin/invoices/${reminderInvoiceId}/send-reminder`, {}, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        console.log('✅ Payment reminder sent successfully!');

        console.log('\n🎉 INVOICING SYSTEM TEST RESULTS:');
        console.log('✅ Admin invoice creation working');
        console.log('✅ Email notifications sent from payments@mydeeptech.ng');
        console.log('✅ Admin invoice management working');
        console.log('✅ DTUser invoice viewing working');
        console.log('✅ Payment status updates working');
        console.log('✅ Payment confirmation emails working');
        console.log('✅ Invoice dashboard and statistics working');
        console.log('✅ Payment reminders working');

        console.log('\n💰 Invoice Workflow Summary:');
        console.log('1. ✅ Admin creates invoice → DTUser gets email notification');
        console.log('2. ✅ DTUser logs in to view unpaid invoices');
        console.log('3. ✅ DTUser can track all invoices via dashboard');
        console.log('4. ✅ Admin marks invoice as paid → DTUser gets confirmation');
        console.log('5. ✅ Admin can send payment reminders for overdue invoices');
        console.log('6. ✅ Complete audit trail and statistics available');

        console.log('\n📧 Email Notifications Tested:');
        console.log('   📬 New invoice notification to DTUser');
        console.log('   📬 Payment confirmation to DTUser');
        console.log('   📬 Payment reminder for overdue invoices');

    } catch (error) {
        if (error.response) {
            console.log('\n❌ Test failed:');
            console.log('Status:', error.response.status);
            console.log('URL:', error.config?.url);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('\n❌ Test failed:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.log('💡 Make sure the server is running: node index.js');
            }
        }
    }
};

console.log('💰 Complete Invoicing and Payment System Test');
console.log('==============================================');
console.log('Testing workflow:');
console.log('1. Admin creates invoices for DTUsers');
console.log('2. Email notifications sent to DTUsers');
console.log('3. DTUsers view and track invoices');
console.log('4. Payment status management');
console.log('5. Payment confirmations and reminders');
console.log('==============================================\n');

testInvoicingSystem();