# Bulk Payment API Documentation

## Overview

The Bulk Payment API allows administrators to initiate payments for multiple users simultaneously, supporting 1-50 users per operation. This flexible system can handle payments to freelancers, admins, stakeholders, consultants, or any other user type. Project association is optional, making it suitable for various payment scenarios including project-based payments, bonuses, dividends, and general compensation.

## Payment Types

The system supports various payment types to categorize different kinds of payments:

- **`freelancer_project`**: Project-based payments to freelancers (requires `projectId`)
- **`admin_bonus`**: Performance bonuses or incentives for admin users (no `projectId` needed)
- **`stakeholder_dividend`**: Dividend payments to company stakeholders/investors (no `projectId` needed)
- **`consultant_fee`**: Fees for external consultants (may or may not have `projectId`)
- **`general`**: General payments that don't fit other categories (no `projectId` needed)
- **`other`**: Custom payment types for specific use cases

## Key Features

- **Batch Processing**: Process 1-50 payments in a single operation
- **Double Payment Prevention**: Automatically detects and prevents duplicate payments
- **Error Handling**: Graceful handling of payment failures with detailed error reporting
- **Progress Tracking**: Monitor the status of bulk payment operations
- **Retry Mechanism**: Ability to retry failed payments
- **Cancellation Support**: Cancel pending payments in bulk
- **Dry Run Mode**: Validate payments without processing

## API Endpoints

### 1. Initialize Bulk Payment

**POST** `/api/payments/bulk/initialize`

Initialize payments for multiple users at once.

#### Request Body

```json
{
  "payments": [
    {
      "recipientId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "projectId": "60f7b3b3b3b3b3b3b3b3b3b4", // Optional - omit for non-project payments
      "invoiceId": "60f7b3b3b3b3b3b3b3b3b3b5", // Optional
      "amount": 1000.50,
      "currency": "NGN", // Optional, defaults to NGN
      "customerEmail": "john.doe@example.com",
      "customerName": "John Doe",
      "customerPhone": "+2348012345678", // Optional
      "description": "Project completion payment", // Optional
      "paymentType": "freelancer_project", // Required: freelancer_project, admin_bonus, stakeholder_dividend, consultant_fee, general, other
      "metadata": { // Optional
        "projectPhase": "final",
        "priority": "high"
      }
    },
    {
      "recipientId": "60f7b3b3b3b3b3b3b3b3b3b6",
      "amount": 750.00,
      "customerEmail": "admin@example.com",
      "customerName": "Jane Smith",
      "paymentType": "admin_bonus",
      "description": "Monthly performance bonus"
      // Note: No projectId needed for admin bonus
    },
    {
      "recipientId": "60f7b3b3b3b3b3b3b3b3b3b7",
      "amount": 2000.00,
      "customerEmail": "stakeholder@example.com",
      "customerName": "Bob Wilson",
      "paymentType": "stakeholder_dividend",
      "description": "Quarterly dividend payment"
      // Note: No projectId needed for dividend
    }
    // ... more payments (up to 50)
  ],
  "currency": "NGN", // Default currency for all payments
  "description": "Monthly user payouts", // Default description
  "callbackUrl": "https://yourapp.com/payment/callback", // Optional
  "channels": ["card", "bank", "ussd"], // Optional payment channels
  "dryRun": false, // Set to true for validation only
  "initiatedBy": "60f7b3b3b3b3b3b3b3b3b3b8" // Optional, can come from auth
}
```

#### Response

```json
{
  "success": true,
  "message": "Bulk payment processing completed. 45 successful, 5 failed.",
  "data": {
    "batchId": "bulk_1645123456_abc123def",
    "totalPayments": 50,
    "successful": [
      {
        "index": 1,
        "recipientId": "60f7b3b3b3b3b3b3b3b3b3b3",
        "projectId": "60f7b3b3b3b3b3b3b3b3b3b4",
        "amount": 1000.50,
        "status": "success",
        "paymentType": "freelancer_project",
        "paymentReference": "FLP_ABC123_XYZ789",
        "paystackReference": "pstk_ref_123456",
        "authorizationUrl": "https://checkout.paystack.com/abc123",
        "recipientName": "John Doe",
        "projectName": "AI Model Training"
      },
      {
        "index": 2,
        "recipientId": "60f7b3b3b3b3b3b3b3b3b3b6",
        "projectId": null,
        "amount": 750.00,
        "status": "success", 
        "paymentType": "admin_bonus",
        "paymentReference": "FLP_DEF456_ABC123",
        "paystackReference": "pstk_ref_789012",
        "authorizationUrl": "https://checkout.paystack.com/def456",
        "recipientName": "Jane Smith",
        "projectName": null
      }
      // ... more successful payments
    ],
    "failed": [
      {
        "index": 3,
        "recipientId": "60f7b3b3b3b3b3b3b3b3b3b9",
        "projectId": "60f7b3b3b3b3b3b3b3b3b3ba",
        "amount": 500.00,
        "status": "failed",
        "paymentType": "freelancer_project",
        "error": "Recipient not found",
        "recipientName": "Unknown",
        "projectName": "Unknown"
      }
      // ... more failed payments
    ],
    "summary": {
      "successCount": 45,
      "failureCount": 5,
      "totalAmount": 25000.00,
      "successfulAmount": 22500.00
    }
  }
}
```

### 2. Get Bulk Payment Status

**GET** `/api/payments/bulk/:batchId/status?page=1&limit=50`

Retrieve the status of a bulk payment operation.

#### Response

```json
{
  "success": true,
  "message": "Bulk payment status retrieved successfully",
  "data": {
    "batchId": "bulk_1645123456_abc123def",
    "totalPayments": 50,
    "currentPage": 1,
    "totalPages": 1,
    "summary": {
      "total": 50,
      "pending": 0,
      "processing": 2,
      "success": 45,
      "failed": 3,
      "totalAmount": 2500000,
      "successfulAmount": 2250000
    },
    "payments": [
      {
        "paymentReference": "FLP_ABC123_XYZ789",
        "paystackReference": "pstk_ref_123456",
        "recipient": "John Doe",
        "project": "AI Model Training",
        "amount": 100050,
        "status": "success",
        "paymentType": "freelancer_project",
        "createdAt": "2024-02-24T10:30:00.000Z",
        "completedAt": "2024-02-24T10:35:00.000Z",
        "authorizationUrl": "https://checkout.paystack.com/abc123"
      }
      // ... more payments
    ]
  }
}
```

### 3. Retry Failed Payments

**POST** `/api/payments/bulk/:batchId/retry`

Retry failed payments from a bulk operation.

#### Request Body

```json
{
  "paymentReferences": [ // Optional - specific payments to retry
    "FLP_ABC123_XYZ789",
    "FLP_DEF456_UVW012"
  ],
  "initiatedBy": "60f7b3b3b3b3b3b3b3b3b3b8" // Optional
}
```

#### Response

```json
{
  "success": true,
  "message": "Bulk payment retry completed. 3 successful, 0 failed.",
  "data": {
    "batchId": "bulk_1645123456_abc123def",
    "originalBatchId": "bulk_1645123456_abc123def",
    "retryBatchId": "retry_bulk_1645123456_abc123def_1645123500",
    "totalRetries": 3,
    "successful": [
      {
        "originalReference": "FLP_ABC123_XYZ789",
        "newReference": "FLP_GHI789_MNO345",
        "paystackReference": "pstk_ref_789012",
        "amount": 50000,
        "recipient": "Jane Smith",
        "project": "Data Analysis",
        "paymentType": "freelancer_project",
        "authorizationUrl": "https://checkout.paystack.com/ghi789"
      }
    ],
    "failed": [],
    "summary": {
      "successCount": 3,
      "failureCount": 0,
      "totalAmount": 150000,
      "successfulAmount": 150000
    }
  }
}
```

### 4. Cancel Bulk Payments

**DELETE** `/api/payments/bulk/:batchId/cancel`

Cancel pending payments in a bulk operation.

#### Request Body

```json
{
  "reason": "Budget constraints - cancelling pending payments"
}
```

#### Response

```json
{
  "success": true,
  "message": "5 payments cancelled successfully",
  "data": {
    "batchId": "bulk_1645123456_abc123def",
    "totalCancelled": 5,
    "cancelledPayments": [
      {
        "paymentReference": "FLP_ABC123_XYZ789",
        "recipient": "John Doe",
        "project": "AI Model Training",
        "amount": 100050,
        "paymentType": "freelancer_project",
        "status": "cancelled"
      }
      // ... more cancelled payments
    ]
  }
}
```

### 5. Dry Run Validation

To validate payments without processing them, set `dryRun: true` in the initialization request:

```json
{
  "payments": [
    // ... payment array
  ],
  "dryRun": true
}
```

#### Dry Run Response

```json
{
  "success": true,
  "message": "Bulk payment validation successful",
  "data": {
    "totalPayments": 20,
    "validPayments": 18,
    "duplicatesFound": 2,
    "estimatedTotalAmount": 45000.00,
    "previewPayments": [
      // First 3 payments as preview
    ]
  }
}
```

## Safety Features

### 1. Duplicate Payment Prevention

The system prevents duplicate payments by:

- Checking for duplicate freelancer-project-amount combinations within the batch
- Verifying no pending payments exist for the same freelancer-project combination in the last 24 hours
- Generating unique payment references for each transaction

### 2. Validation Checks

Before processing, the system validates:

- All required fields are present
- Freelancers and projects exist in the database
- Email formats are valid
- Amount values are positive
- Batch size is within limits (1-50 payments)

### 3. Error Handling

The system handles errors gracefully by:

- Processing payments in chunks of 5 to prevent system overload
- Adding delays between chunks to avoid rate limiting
- Continuing processing even if some payments fail
- Providing detailed error messages for each failure

### 4. Rate Limiting Protection

- Payments are processed in chunks of 5
- 1-second delay between chunks
- 500ms delay between retry attempts

## Usage Examples

### Example 1: Mixed Payment Types

```javascript
const mixedPaymentData = {
  payments: [
    // Freelancer working on a project
    {
      recipientId: "freelancer_123",
      projectId: "project_456",
      amount: 1500,
      customerEmail: "freelancer@example.com",
      customerName: "John Developer",
      paymentType: "freelancer_project",
      description: "Feature development completion"
    },
    // Admin bonus (no project)
    {
      recipientId: "admin_789", 
      amount: 800,
      customerEmail: "admin@company.com",
      customerName: "Jane Manager",
      paymentType: "admin_bonus",
      description: "Q4 performance bonus"
    },
    // Stakeholder dividend (no project)
    {
      recipientId: "investor_101",
      amount: 5000,
      customerEmail: "investor@capital.com", 
      customerName: "Investment Corp",
      paymentType: "stakeholder_dividend",
      description: "Quarterly dividend payment"
    }
  ]
};

const response = await fetch('/api/payments/bulk/initialize', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(mixedPaymentData)
});
```

### Example 2: Admin Team Bonuses

```javascript
const adminBonuses = {
  payments: [
    {
      recipientId: "admin_001",
      amount: 2000,
      customerEmail: "ceo@company.com",
      customerName: "CEO Name", 
      paymentType: "admin_bonus",
      description: "Annual leadership bonus"
    },
    {
      recipientId: "admin_002",
      amount: 1500,
      customerEmail: "cto@company.com",
      customerName: "CTO Name",
      paymentType: "admin_bonus", 
      description: "Technical excellence bonus"
    }
  ],
  description: "Executive team annual bonuses"
};
```

### Example 3: Stakeholder Dividends

```javascript
const dividendPayments = {
  payments: [
    {
      recipientId: "investor_001",
      amount: 10000,
      customerEmail: "investor1@fund.com",
      customerName: "Venture Capital Fund",
      paymentType: "stakeholder_dividend",
      description: "Q4 2026 dividend - 25% shareholding",
      metadata: {
        shareholding: "25%",
        period: "Q4-2026"
      }
    },
    {
      recipientId: "investor_002", 
      amount: 6000,
      customerEmail: "angel@investor.com",
      customerName: "Angel Investor",
      paymentType: "stakeholder_dividend",
      description: "Q4 2026 dividend - 15% shareholding"
    }
  ],
  description: "Quarterly dividend distribution"
};
```

## Usage Examples

### Example 1: Basic Bulk Payment

```javascript
const bulkPaymentData = {
  payments: [
    {
      freelancerId: "60f7b3b3b3b3b3b3b3b3b3b3",
      projectId: "60f7b3b3b3b3b3b3b3b3b3b4",
      amount: 1000,
      customerEmail: "john@example.com",
      customerName: "John Doe"
    },
    {
      freelancerId: "60f7b3b3b3b3b3b3b3b3b3b5",
      projectId: "60f7b3b3b3b3b3b3b3b3b3b6",
      amount: 1500,
      customerEmail: "jane@example.com",
      customerName: "Jane Smith"
    }
  ]
};

const response = await fetch('/api/payments/bulk/initialize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify(bulkPaymentData)
});
```

### Example 2: Validation First (Dry Run)

```javascript
const validationData = {
  ...bulkPaymentData,
  dryRun: true
};

const validationResponse = await fetch('/api/payments/bulk/initialize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify(validationData)
});

if (validationResponse.data.duplicatesFound === 0) {
  // Proceed with actual payment processing
  validationData.dryRun = false;
  const paymentResponse = await fetch('/api/payments/bulk/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-jwt-token'
    },
    body: JSON.stringify(validationData)
  });
}
```

### Example 3: Monitor and Retry

```javascript
// Initialize bulk payment
const initResponse = await initializeBulkPayment(paymentData);
const batchId = initResponse.data.batchId;

// Check status periodically
const checkStatus = async () => {
  const statusResponse = await fetch(`/api/payments/bulk/${batchId}/status`);
  const status = statusResponse.data;
  
  console.log(`Progress: ${status.summary.success}/${status.summary.total} completed`);
  
  if (status.summary.failed > 0) {
    console.log(`${status.summary.failed} payments failed. Retrying...`);
    
    // Retry failed payments
    const retryResponse = await fetch(`/api/payments/bulk/${batchId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-jwt-token'
      }
    });
  }
};

// Check status every 30 seconds
const statusInterval = setInterval(checkStatus, 30000);
```

## Error Handling

### Common Error Scenarios

1. **Validation Errors (400)**
   - Missing required fields
   - Invalid email formats
   - Duplicate payments in batch
   - Batch size exceeds limit

2. **Not Found Errors (404)**
   - Freelancer not found
   - Project not found
   - Batch not found

3. **Conflict Errors (409)**
   - Duplicate payment exists
   - Pending payment found

4. **System Errors (500)**
   - Payment gateway failures
   - Database connection issues

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400,
  "data": {
    "errors": [
      "Payment 1: freelancerId is required",
      "Payment 3: invalid email format"
    ]
  }
}
```

## Best Practices

1. **Always use dry run first** for large batches to validate data
2. **Monitor batch status** regularly during processing
3. **Handle failed payments** by retrying or investigating issues
4. **Keep batch sizes reasonable** (20-30 payments) for optimal performance
5. **Implement proper error logging** in your application
6. **Use unique payment references** to track transactions
7. **Validate data thoroughly** before sending to API
8. **Consider rate limiting** in your application to avoid overwhelming the system

## Security Considerations

- All bulk payment operations require admin authentication
- Payment references are generated server-side to prevent tampering
- Sensitive payment data is logged with appropriate security measures
- Webhook signatures are validated for callback security
- Input validation prevents injection attacks

## Performance Notes

- Payments are processed in chunks to optimize performance
- Database queries are optimized with proper indexing
- Error scenarios don't block the entire batch
- Memory usage is controlled through streaming where possible
- Rate limiting prevents system overload

## Support

For issues related to the Bulk Payment API:

1. Check the error response for specific validation issues
2. Review the batch status endpoint for processing details
3. Use the retry mechanism for failed payments
4. Contact technical support with batch IDs for investigation

---

**Version**: 1.0  
**Last Updated**: February 24, 2026  
**Compatibility**: Paystack Payment Gateway v2