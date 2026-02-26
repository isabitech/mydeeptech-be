# Bulk Payment vs Bulk Transfer Implementation Guide

This document explains the two approaches for handling bulk payments in our system and provides guidance on when to use each approach.

## Overview

We have implemented two approaches for handling bulk payments:

1. **Bulk Payments** (Collection API) - Original implementation for collecting money FROM customers
2. **Bulk Transfers** (Transfer API) - New implementation using Paystack's native bulk transfer for sending money TO recipients

## Key Differences

| Feature | Bulk Payments | Bulk Transfers |
|---------|---------------|----------------|
| **Purpose** | Collect money FROM customers | Send money TO recipients |
| **API Used** | Paystack Payment Initialization API | Paystack Bulk Transfer API |
| **Customer Interaction** | Requires customer to complete payment | No customer interaction - direct transfer |
| **Source** | Customer's account/card | Business account balance |
| **Use Case** | Invoice payments, service charges | Salary, bonuses, dividends, refunds |
| **Maximum Recipients** | 50 per batch | 100 per batch |
| **Processing** | Individual payment links | Bulk processing every 5 seconds |
| **Prerequisites** | Customer payment details | Pre-created recipient codes |

## When to Use Each Approach

### Use Bulk Payments When:
- Collecting payments from multiple customers
- Sending invoices for services rendered
- Charging for subscriptions or services
- Requiring customer authorization for payment

### Use Bulk Transfers When:
- Paying freelancers for completed work
- Distributing bonuses to employees
- Paying stakeholder dividends
- Processing refunds
- Any scenario where you're sending money from your business account

## Implementation Details

### Bulk Transfers (Recommended for Payouts)

#### Prerequisites
1. Create transfer recipients for each recipient:
```http
POST /api/payments/recipients/create
{
  "name": "John Doe",
  "account_number": "1234567890",
  "bank_code": "057",
  "email": "john@example.com",
  "description": "Freelancer payment recipient"
}
```

2. Get list of supported banks:
```http
GET /api/payments/banks?country=nigeria
```

#### Bulk Transfer Request
```http
POST /api/payments/transfer/bulk
{
  "transfers": [
    {
      "recipient": "RCP_recipient_code_here", // From step 1
      "amount": 5000.00,
      "reference": "transfer_ref_001",
      "reason": "Freelancer payment for Project A",
      "recipientId": "674abc123def456789012345", // User ID in your database
      "projectId": "674def456ghi789012345678", // Optional
      "paymentType": "freelancer_project"
    },
    {
      "recipient": "RCP_another_recipient_code",
      "amount": 10000.00,
      "reference": "transfer_ref_002",
      "reason": "Stakeholder dividend Q4 2024",
      "recipientId": "674ghi789jkl012345678901",
      "paymentType": "stakeholder_dividend"
    }
  ],
  "currency": "NGN",
  "source": "balance"
}
```

#### Response
```json
{
  "success": true,
  "message": "Bulk transfer initiated successfully",
  "data": {
    "batchId": "bulk_transfer_1703123456789_abc123",
    "totalTransfers": 2,
    "successful": [
      {
        "index": 1,
        "recipientId": "674abc123def456789012345",
        "amount": 5000.00,
        "status": "success",
        "transfer_code": "TRF_abc123xyz789",
        "reference": "transfer_ref_001",
        "paymentType": "freelancer_project"
      }
    ],
    "failed": [
      {
        "index": 2,
        "recipientId": "674ghi789jkl012345678901",
        "amount": 10000.00,
        "status": "failed",
        "error": "Insufficient balance",
        "reference": "transfer_ref_002",
        "paymentType": "stakeholder_dividend"
      }
    ],
    "summary": {
      "total": 2,
      "successful": 1,
      "failed": 1,
      "totalAmount": 15000.00
    }
  }
}
```

### Bulk Payments (For Collection Only)

#### Request
```http
POST /api/payments/bulk/initialize
{
  "payments": [
    {
      "recipientId": "674abc123def456789012345",
      "amount": 1000.00,
      "customerEmail": "customer@example.com",
      "customerName": "Customer Name",
      "description": "Invoice payment",
      "paymentType": "general"
    }
  ],
  "currency": "NGN",
  "description": "Bulk invoice collection"
}
```

## Migration Guide

If you're currently using the bulk payments for payouts, here's how to migrate to bulk transfers:

### Step 1: Create Recipients
For each user you want to pay, create a transfer recipient:

```javascript
// Get user bank details (you'll need to collect these)
const bankDetails = {
  name: `${user.firstname} ${user.lastname}`,
  account_number: user.accountNumber, // You need to collect this
  bank_code: user.bankCode, // You need to collect this
  email: user.email
};

// Create recipient
const recipient = await PaystackTransferService.createRecipient(bankDetails);
// Store recipient.recipient_code in user profile for future use
```

### Step 2: Replace Bulk Payment Calls
Replace calls to `/api/payments/bulk/initialize` with `/api/payments/transfer/bulk`:

```javascript
// Old approach (payment collection)
const paymentData = {
  payments: users.map(user => ({
    recipientId: user._id,
    amount: user.paymentAmount,
    customerEmail: user.email,
    customerName: `${user.firstname} ${user.lastname}`,
    paymentType: 'freelancer_project'
  }))
};

// New approach (direct transfer)
const transferData = {
  transfers: users.map(user => ({
    recipient: user.paystackRecipientCode, // From step 1
    amount: user.paymentAmount,
    reference: `pay_${user._id}_${Date.now()}`,
    reason: 'Freelancer payment',
    recipientId: user._id,
    paymentType: 'freelancer_project'
  }))
};
```

## Error Handling

### Common Transfer Errors
- **Insufficient balance**: Your Paystack account doesn't have enough funds
- **Invalid recipient**: Recipient code is invalid or inactive
- **Duplicate reference**: Reference has been used before
- **Account validation failed**: Recipient's bank account details are invalid

### Rate Limiting
- Bulk transfers are processed every 5 seconds by Paystack
- Maximum 100 transfers per batch
- Consider splitting large transfers into multiple batches

## Webhooks

Set up webhooks to handle transfer status updates:

```http
POST /api/payments/webhook
{
  "event": "transfer.success",
  "data": {
    "reference": "transfer_ref_001",
    "status": "success",
    "transfer_code": "TRF_abc123xyz789",
    "amount": 500000,
    "currency": "NGN"
  }
}
```

## Testing

### Test with Small Amounts
Start with small amounts (₦100-₦500) when testing transfers.

### Sandbox Environment
Use Paystack's sandbox for testing:
- All transfers will be simulated
- No real money will be moved
- Use test bank codes and account numbers

### Verification
Always verify transfers using the verification endpoint:
```http
GET /api/payments/transfer/verify/transfer_ref_001
```

## Best Practices

1. **Always validate recipients**: Ensure recipient codes exist and are active
2. **Use meaningful references**: Include user ID, project ID, and timestamp
3. **Monitor balance**: Check your Paystack balance before large transfers  
4. **Handle failures gracefully**: Implement retry logic for failed transfers
5. **Keep records**: Store transfer references for tracking and reconciliation
6. **Set up webhooks**: Use webhooks for real-time status updates
7. **Batch appropriately**: Don't exceed 100 transfers per batch

## Security Considerations

1. **Admin-only access**: Restrict transfer endpoints to admin users
2. **Validate amounts**: Implement maximum transfer limits
3. **Audit trail**: Log all transfer attempts and results
4. **Duplicate prevention**: Use unique references for each transfer
5. **Balance monitoring**: Alert when balance is low

## Support

For issues with Paystack transfers, check:
1. Paystack dashboard for transfer status
2. Webhook logs for status updates  
3. Your application logs for errors
4. Contact Paystack support for API issues

Paystack Transfer API Documentation: https://paystack.com/docs/api/#transfer