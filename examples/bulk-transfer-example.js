// Example usage of Paystack Bulk Transfer API

/**
 * Complete example showing how to use the new bulk transfer functionality
 * for paying freelancers, admins, or stakeholders.
 */

const axios = require('axios');

// Your API base URL
const API_BASE = 'http://localhost:8000/api'; // Update with your actual API URL

// Example: Admin authentication token (you'll get this from login)
const ADMIN_TOKEN = 'your_admin_jwt_token_here';

// Headers for API requests
const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
};

/**
 * Step 1: Create transfer recipients (one-time setup per user)
 * You need to do this once for each user you want to pay
 */
async function createRecipients() {
    const recipients = [
        {
            name: 'John Doe',
            account_number: '1234567890',
            bank_code: '057', // Zenith Bank code
            email: 'john@example.com',
            description: 'Freelancer - Frontend Developer'
        },
        {
            name: 'Jane Smith',
            account_number: '0987654321',
            bank_code: '044', // Access Bank code
            email: 'jane@example.com',
            description: 'Admin - Project Manager'
        }
    ];

    const createdRecipients = [];

    for (const recipient of recipients) {
        try {
            const response = await axios.post(
                `${API_BASE}/payments/recipients/create`,
                recipient,
                { headers }
            );
            
            console.log(`✅ Created recipient for ${recipient.name}:`, response.data.data.recipient_code);
            createdRecipients.push({
                name: recipient.name,
                email: recipient.email,
                recipient_code: response.data.data.recipient_code
            });
        } catch (error) {
            console.error(`❌ Failed to create recipient for ${recipient.name}:`, error.response?.data?.message);
        }
    }

    return createdRecipients;
}

/**
 * Step 2: Get list of available banks (helper function)
 */
async function listBanks() {
    try {
        const response = await axios.get(
            `${API_BASE}/payments/banks`,
            { headers }
        );
        
        console.log('📋 Available banks:');
        response.data.data.banks.forEach(bank => {
            console.log(`  ${bank.code}: ${bank.name}`);
        });
        
        return response.data.data.banks;
    } catch (error) {
        console.error('❌ Failed to fetch banks:', error.response?.data?.message);
    }
}

/**
 * Step 3: Execute bulk transfer to multiple recipients
 */
async function executeBulkTransfer() {
    // Sample transfer data - replace with your actual data
    const transfers = [
        {
            recipient: 'RCP_recipient_code_1', // Replace with actual recipient code from step 1
            amount: 25000.00, // ₦25,000
            reference: `freelancer_pay_${Date.now()}_001`,
            reason: 'Payment for Project XYZ - Frontend Development',
            recipientId: '674abc123def456789012345', // Your database user ID
            projectId: '674def456ghi789012345678', // Optional project ID
            paymentType: 'freelancer_project',
            description: 'December 2024 project payment'
        },
        {
            recipient: 'RCP_recipient_code_2', // Replace with actual recipient code from step 1
            amount: 15000.00, // ₦15,000
            reference: `admin_bonus_${Date.now()}_002`,
            reason: 'Q4 2024 Performance Bonus',
            recipientId: '674ghi789jkl012345678901', // Your database user ID
            paymentType: 'admin_bonus',
            description: 'Quarterly performance bonus'
        },
        {
            recipient: 'RCP_recipient_code_3', // Replace with actual recipient code for stakeholder
            amount: 100000.00, // ₦100,000
            reference: `dividend_${Date.now()}_003`,
            reason: 'Q4 2024 Stakeholder Dividend',
            recipientId: '674jkl012mno345678901234', // Your database user ID
            paymentType: 'stakeholder_dividend',
            description: 'Quarterly dividend payment'
        }
    ];

    try {
        const response = await axios.post(
            `${API_BASE}/payments/transfer/bulk`,
            {
                transfers,
                currency: 'NGN',
                source: 'balance'
            },
            { headers }
        );

        const result = response.data.data;
        
        console.log('\n🎉 Bulk transfer completed!');
        console.log(`📊 Batch ID: ${result.batchId}`);
        console.log(`📈 Summary: ${result.summary.successful}/${result.summary.total} successful transfers`);
        console.log(`💰 Total Amount: ₦${result.summary.totalAmount.toLocaleString()}`);
        
        // Show successful transfers
        if (result.successful.length > 0) {
            console.log('\n✅ Successful Transfers:');
            result.successful.forEach(transfer => {
                console.log(`  ${transfer.index}. ₦${transfer.amount.toLocaleString()} to ${transfer.recipientId} (${transfer.paymentType})`);
                console.log(`     Status: ${transfer.status} | Reference: ${transfer.reference}`);
            });
        }

        // Show failed transfers
        if (result.failed.length > 0) {
            console.log('\n❌ Failed Transfers:');
            result.failed.forEach(transfer => {
                console.log(`  ${transfer.index}. ₦${transfer.amount.toLocaleString()} to ${transfer.recipientId} (${transfer.paymentType})`);
                console.log(`     Error: ${transfer.error} | Reference: ${transfer.reference}`);
            });
        }

        return result;
    } catch (error) {
        console.error('❌ Bulk transfer failed:', error.response?.data?.message);
        if (error.response?.data?.data?.errors) {
            console.log('📝 Validation errors:');
            error.response.data.data.errors.forEach(err => console.log(`  - ${err}`));
        }
        return null;
    }
}

/**
 * Step 4: Verify individual transfer status
 */
async function verifyTransfer(reference) {
    try {
        const response = await axios.get(
            `${API_BASE}/payments/transfer/verify/${reference}`,
            { headers }
        );

        const transfer = response.data.data.transfer;
        
        console.log(`\n🔍 Transfer Verification for ${reference}:`);
        console.log(`  Status: ${transfer.status}`);
        console.log(`  Amount: ₦${(transfer.amount / 100).toLocaleString()}`); // Convert kobo to naira
        console.log(`  Recipient: ${transfer.recipient.name}`);
        console.log(`  Date: ${new Date(transfer.createdAt).toLocaleString()}`);
        
        return transfer;
    } catch (error) {
        console.error(`❌ Failed to verify transfer ${reference}:`, error.response?.data?.message);
        return null;
    }
}

/**
 * Complete workflow example
 */
async function completeWorkflow() {
    console.log('🚀 Starting Paystack Bulk Transfer Workflow...\n');

    try {
        // Step 1: List available banks (for reference)
        console.log('Step 1: Fetching available banks...');
        await listBanks();

        // Step 2: Create recipients (if not already created)
        console.log('\nStep 2: Creating transfer recipients...');
        const recipients = await createRecipients();

        if (recipients.length === 0) {
            console.log('⚠️  No recipients created. Cannot proceed with transfers.');
            return;
        }

        // Wait a bit for recipient creation to process
        console.log('\nWaiting 3 seconds for recipient processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 3: Execute bulk transfers
        console.log('\nStep 3: Executing bulk transfers...');
        const transferResult = await executeBulkTransfer();

        if (!transferResult) {
            console.log('⚠️  Bulk transfer failed. Cannot proceed with verification.');
            return;
        }

        // Step 4: Verify successful transfers
        console.log('\nStep 4: Verifying transfers...');
        for (const transfer of transferResult.successful) {
            await verifyTransfer(transfer.reference);
            // Small delay between verification requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n✅ Workflow completed successfully!');

    } catch (error) {
        console.error('💥 Workflow failed with error:', error.message);
    }
}

/**
 * Simple example for a single payment type (freelancer payments)
 */
async function payFreelancers() {
    const freelancerPayments = [
        {
            recipient: 'RCP_freelancer_1_code',
            amount: 50000.00,
            reference: `freelancer_${Date.now()}_001`,
            reason: 'Website Development - December 2024',
            recipientId: '674abc123def456789012345',
            projectId: '674def456ghi789012345678',
            paymentType: 'freelancer_project'
        }
        // Add more freelancers as needed
    ];

    try {
        const response = await axios.post(
            `${API_BASE}/payments/transfer/bulk`,
            { transfers: freelancerPayments },
            { headers }
        );

        console.log('💼 Freelancer payments processed:', response.data.data.summary);
        return response.data.data;
    } catch (error) {
        console.error('❌ Freelancer payment failed:', error.response?.data?.message);
        return null;
    }
}

// Export functions for use in other modules
module.exports = {
    createRecipients,
    listBanks,
    executeBulkTransfer,
    verifyTransfer,
    completeWorkflow,
    payFreelancers
};

// Run the complete workflow if this file is executed directly
if (require.main === module) {
    completeWorkflow().catch(console.error);
}

/* 
SAMPLE OUTPUT:
🚀 Starting Paystack Bulk Transfer Workflow...

Step 1: Fetching available banks...
📋 Available banks:
  044: Access Bank
  057: Zenith Bank
  058: Guaranty Trust Bank
  ...

Step 2: Creating transfer recipients...
✅ Created recipient for John Doe: RCP_abc123xyz
✅ Created recipient for Jane Smith: RCP_def456uvw

Step 3: Executing bulk transfers...

🎉 Bulk transfer completed!
📊 Batch ID: bulk_transfer_1703123456789_abc123
📈 Summary: 2/3 successful transfers
💰 Total Amount: ₦140,000

✅ Successful Transfers:
  1. ₦25,000 to 674abc123def456789012345 (freelancer_project)
     Status: success | Reference: freelancer_pay_1703123456_001
  2. ₦15,000 to 674ghi789jkl012345678901 (admin_bonus)
     Status: success | Reference: admin_bonus_1703123456_002

❌ Failed Transfers:
  3. ₦100,000 to 674jkl012mno345678901234 (stakeholder_dividend)
     Error: Insufficient balance | Reference: dividend_1703123456_003

Step 4: Verifying transfers...

🔍 Transfer Verification for freelancer_pay_1703123456_001:
  Status: success
  Amount: ₦25,000
  Recipient: John Doe
  Date: 12/21/2024, 10:30:45 AM

✅ Workflow completed successfully!
*/