// Example: Flexible Bulk Payment Implementation
// This file demonstrates how to use the bulk payment API for different user types (freelancers, admins, stakeholders, etc.)

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api/payments';
const AUTH_TOKEN = 'your-jwt-token-here';

// Helper function to make authenticated requests
const apiCall = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
};

// Example 1: Mixed Payment Types (Freelancers, Admins, Stakeholders)
async function mixedBulkPayment() {
  const paymentData = {
    payments: [
      // Freelancer project payment
      {
        recipientId: "60f7b3b3b3b3b3b3b3b3b3b3",
        projectId: "60f7b3b3b3b3b3b3b3b3b3b4", 
        amount: 1000.50,
        customerEmail: "john.doe@example.com",
        customerName: "John Doe",
        customerPhone: "+2348012345678",
        paymentType: "freelancer_project",
        description: "Project completion payment"
      },
      // Admin bonus (no project)
      {
        recipientId: "60f7b3b3b3b3b3b3b3b3b3b5",
        amount: 750.00,
        customerEmail: "admin@example.com", 
        customerName: "Jane Smith",
        paymentType: "admin_bonus",
        description: "Monthly performance bonus"
      },
      // Stakeholder dividend (no project)
      {
        recipientId: "60f7b3b3b3b3b3b3b3b3b3b7",
        amount: 1200.75,
        customerEmail: "stakeholder@example.com",
        customerName: "Bob Wilson",
        paymentType: "stakeholder_dividend",
        description: "Quarterly dividend payment"
      },
      // Consultant fee with project
      {
        recipientId: "60f7b3b3b3b3b3b3b3b3b3b8",
        projectId: "60f7b3b3b3b3b3b3b3b3b3b9",
        amount: 800.00,
        customerEmail: "consultant@example.com",
        customerName: "Alice Cooper",
        paymentType: "consultant_fee",
        description: "UI/UX consultation fee"
      }
    ],
    currency: "NGN",
    description: "Mixed user type payouts",
    callbackUrl: "https://yourapp.com/payment/callback"
  };

  try {
    console.log('Initiating mixed bulk payment...');
    const response = await apiCall('POST', '/bulk/initialize', paymentData);
    
    console.log(`Bulk payment initiated: ${response.data.summary.successCount} successful, ${response.data.summary.failureCount} failed`);
    console.log(`Batch ID: ${response.data.batchId}`);
    
    // Log payment types
    response.data.successful.forEach(payment => {
      console.log(`  ✓ ${payment.recipientName} (${payment.paymentType}): ₦${payment.amount}`);
    });
    
    return response.data.batchId;
  } catch (error) {
    console.error('Failed to initiate bulk payment:', error);
    throw error;
  }
}

// Example 2: Dry Run Validation
async function validateBulkPayment(paymentData) {
  try {
    console.log('Validating payment data...');
    
    const validationData = {
      ...paymentData,
      dryRun: true
    };
    
    const response = await apiCall('POST', '/bulk/initialize', validationData);
    
    console.log('Validation results:');
    console.log(`- Total payments: ${response.data.totalPayments}`);
    console.log(`- Valid payments: ${response.data.validPayments}`);
    console.log(`- Duplicates found: ${response.data.duplicatesFound}`);
    console.log(`- Estimated total: ₦${response.data.estimatedTotalAmount}`);
    
    return response.data.duplicatesFound === 0 && response.data.validPayments === response.data.totalPayments;
  } catch (error) {
    console.error('Validation failed:', error);
    return false;
  }
}

// Example 3: Monitor Payment Progress
async function monitorBulkPayment(batchId) {
  const maxAttempts = 20; // Maximum monitoring attempts
  let attempts = 0;
  
  console.log(`Monitoring batch ${batchId}...`);
  
  const checkStatus = async () => {
    try {
      const response = await apiCall('GET', `/bulk/${batchId}/status`);
      const summary = response.data.summary;
      
      console.log(`Progress: ${summary.success}/${summary.total} completed (${summary.failed} failed)`);
      
      // If all payments are processed (success or failed)
      if (summary.success + summary.failed >= summary.total) {
        console.log('All payments processed!');
        return { completed: true, summary };
      }
      
      return { completed: false, summary };
    } catch (error) {
      console.error('Error checking status:', error);
      return { completed: false, error: true };
    }
  };
  
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      attempts++;
      const result = await checkStatus();
      
      if (result.completed || result.error || attempts >= maxAttempts) {
        clearInterval(interval);
        resolve(result);
      }
    }, 5000); // Check every 5 seconds
  });
}

// Example 4: Retry Failed Payments
async function retryFailedPayments(batchId) {
  try {
    console.log(`Retrying failed payments for batch ${batchId}...`);
    
    const response = await apiCall('POST', `/bulk/${batchId}/retry`);
    
    console.log(`Retry completed: ${response.data.summary.successCount} successful, ${response.data.summary.failureCount} failed`);
    console.log(`New retry batch ID: ${response.data.retryBatchId}`);
    
    return response.data;
  } catch (error) {
    console.error('Failed to retry payments:', error);
    throw error;
  }
}

// Example 5: Cancel Pending Payments
async function cancelBulkPayment(batchId, reason = 'Operation cancelled') {
  try {
    console.log(`Cancelling pending payments for batch ${batchId}...`);
    
    const response = await apiCall('DELETE', `/bulk/${batchId}/cancel`, { reason });
    
    console.log(`Cancelled ${response.data.totalCancelled} payments`);
    
    return response.data;
  } catch (error) {
    console.error('Failed to cancel payments:', error);
    throw error;
  }
}

// Example 6: Complete Workflow
async function completeBulkPaymentWorkflow() {
  try {
    // Step 1: Prepare mixed payment data
    const paymentData = {
      payments: [
        // Project-based freelancer payment
        {
          recipientId: "60f7b3b3b3b3b3b3b3b3b3b3",
          projectId: "60f7b3b3b3b3b3b3b3b3b3b4",
          amount: 500,
          customerEmail: "freelancer1@example.com",
          customerName: "Alice Johnson",
          paymentType: "freelancer_project"
        },
        // Non-project admin bonus
        {
          recipientId: "60f7b3b3b3b3b3b3b3b3b3b5", 
          amount: 750,
          customerEmail: "admin@example.com",
          customerName: "Bob Smith",
          paymentType: "admin_bonus"
        },
        // General payment (no specific category)
        {
          recipientId: "60f7b3b3b3b3b3b3b3b3b3b7",
          amount: 300,
          customerEmail: "user@example.com",
          customerName: "Carol Davis",
          paymentType: "general"
        }
      ]
    };
    
    // Step 2: Validate first
    console.log('=== VALIDATION PHASE ===');
    const isValid = await validateBulkPayment(paymentData);
    
    if (!isValid) {
      console.log('Validation failed. Please correct the errors and try again.');
      return;
    }
    
    // Step 3: Initialize bulk payment
    console.log('=== INITIALIZATION PHASE ===');
    const batchId = await mixedBulkPayment();
    
    // Step 4: Monitor progress
    console.log('=== MONITORING PHASE ===');
    const result = await monitorBulkPayment(batchId);
    
    if (result.summary && result.summary.failed > 0) {
      console.log('=== RETRY PHASE ===');
      await retryFailedPayments(batchId);
      
      // Monitor retry progress
      const retryResult = await monitorBulkPayment(batchId);
      console.log('Final result:', retryResult.summary);
    }
    
    console.log('=== WORKFLOW COMPLETED ===');
    
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

// Example 7: Batch with Error Handling
async function robustBulkPayment(payments, options = {}) {
  const {
    maxRetries = 2,
    validationOnly = false,
    autoRetry = true
  } = options;
  
  try {
    // Validate data structure
    if (!Array.isArray(payments) || payments.length === 0) {
      throw new Error('Payments must be a non-empty array');
    }
    
    if (payments.length > 50) {
      throw new Error('Maximum 50 payments per batch');
    }
    
    // Prepare payment data
    const paymentData = {
      payments,
      currency: 'NGN',
      description: 'Bulk payment operation'
    };
    
    // Validation phase
    console.log('🔍 Validating payment data...');
    const validationResult = await validateBulkPayment(paymentData);
    
    if (!validationResult) {
      throw new Error('Payment validation failed');
    }
    
    if (validationOnly) {
      console.log('✅ Validation successful - stopping here (validation only mode)');
      return { success: true, validationOnly: true };
    }
    
    // Initialize payment
    console.log('🚀 Initializing bulk payment...');
    const batchId = await basicBulkPayment();
    
    // Monitor with retries
    let retryCount = 0;
    let finalResult = null;
    
    while (retryCount <= maxRetries) {
      console.log(`📊 Monitoring attempt ${retryCount + 1}/${maxRetries + 1}...`);
      
      const monitorResult = await monitorBulkPayment(batchId);
      finalResult = monitorResult;
      
      if (monitorResult.summary && monitorResult.summary.failed > 0 && autoRetry && retryCount < maxRetries) {
        console.log(`🔄 Retrying ${monitorResult.summary.failed} failed payments...`);
        await retryFailedPayments(batchId);
        retryCount++;
      } else {
        break;
      }
    }
    
    return {
      success: true,
      batchId,
      finalResult,
      retryCount
    };
    
  } catch (error) {
    console.error('❌ Robust bulk payment failed:', error);
    throw error;
  }
}

// Example 8: Admin and Stakeholder Payments (No Projects Required)
async function adminStakeholderPayments() {
  const paymentData = {
    payments: [
      // Admin monthly bonus
      {
        recipientId: "admin_user_id_1",
        amount: 5000,
        customerEmail: "admin1@company.com",
        customerName: "Sarah Manager",
        paymentType: "admin_bonus",
        description: "Q4 performance bonus",
        metadata: {
          quarter: "Q4",
          year: 2026,
          performanceRating: "excellent"
        }
      },
      // Another admin bonus
      {
        recipientId: "admin_user_id_2", 
        amount: 3000,
        customerEmail: "admin2@company.com",
        customerName: "Mike Supervisor",
        paymentType: "admin_bonus",
        description: "Project management excellence bonus"
      },
      // Stakeholder dividend
      {
        recipientId: "stakeholder_id_1",
        amount: 15000,
        customerEmail: "investor@company.com", 
        customerName: "John Investor",
        paymentType: "stakeholder_dividend",
        description: "Quarterly dividend - Q4 2026",
        metadata: {
          dividendPeriod: "Q4-2026",
          shareholding: "15%"
        }
      },
      // Consultant fee (with project)
      {
        recipientId: "consultant_id_1",
        projectId: "project_abc123", 
        amount: 8000,
        customerEmail: "consultant@external.com",
        customerName: "Dr. Expert Consultant",
        paymentType: "consultant_fee",
        description: "Technical consulting and architecture review"
      }
    ]
  };

  try {
    console.log('Processing admin and stakeholder payments...');
    
    // First validate
    const validationResult = await validateBulkPayment(paymentData);
    if (!validationResult) {
      throw new Error('Validation failed');
    }

    // Then process
    const response = await apiCall('POST', '/bulk/initialize', paymentData);
    
    console.log('Payment Summary:');
    console.log(`- Total payments: ${response.data.totalPayments}`);
    console.log(`- Successful: ${response.data.summary.successCount}`);
    console.log(`- Failed: ${response.data.summary.failureCount}`);
    console.log(`- Total amount: ₦${response.data.summary.totalAmount}`);
    
    // Group by payment type
    const paymentsByType = response.data.successful.reduce((acc, payment) => {
      acc[payment.paymentType] = (acc[payment.paymentType] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Payments by type:');
    Object.entries(paymentsByType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} payments`);
    });
    
    return response.data.batchId;
  } catch (error) {
    console.error('Admin/stakeholder payment failed:', error);
    throw error;
  }
}

// Usage examples
async function runExamples() {
  try {
    console.log('=== BULK PAYMENT EXAMPLES ===\n');
    
    // Example 1: Simple validation
    console.log('1. Running validation example...');
    await validateBulkPayment({
      payments: [
        {
          recipientId: "60f7b3b3b3b3b3b3b3b3b3b3",
          projectId: "60f7b3b3b3b3b3b3b3b3b3b4",
          amount: 100,
          customerEmail: "test@example.com",
          customerName: "Test User",
          paymentType: "freelancer_project"
        }
      ]
    });
    
    console.log('\n2. Running complete workflow...');
    await completeBulkPaymentWorkflow();
    
    console.log('\n3. Running admin/stakeholder payments...');
    await adminStakeholderPayments();
    
    console.log('\n4. Running robust bulk payment...');
    await robustBulkPayment([
      {
        recipientId: "60f7b3b3b3b3b3b3b3b3b3b3",
        projectId: "60f7b3b3b3b3b3b3b3b3b3b4",
        amount: 500,
        customerEmail: "freelancer@example.com",
        customerName: "Freelancer Name",
        paymentType: "freelancer_project"
      }
    ], {
      validationOnly: true, // Set to false for actual processing
      autoRetry: true,
      maxRetries: 2
    });
    
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export functions for use in other modules
module.exports = {
  mixedBulkPayment,
  adminStakeholderPayments,
  validateBulkPayment,
  monitorBulkPayment,
  retryFailedPayments,
  cancelBulkPayment,
  completeBulkPaymentWorkflow,
  robustBulkPayment,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}