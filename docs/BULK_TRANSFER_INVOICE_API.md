# 🏦 Bulk Transfer with Invoice-based Payments API

## Overview
This new endpoint allows administrators to process bulk transfers to freelancers using invoice data, with automatic USD to NGN currency conversion via the Exchange Rate API.

## Endpoint
```
POST /api/payments/transfer/bulk-invoices
```

### Authentication
- **Required**: Admin JWT token
- **Middleware**: `authenticateToken` + `authenticateAdmin`

---

## Request Format

### Headers
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

### Request Body
```json
{
  "transfers": [
    {
      "invoiceId": "607f1f77bcf86cd799439011",
      "recipientName": "John Doe",
      "recipientEmail": "john.doe@example.com", 
      "recipientPhone": "+2348123456789",
      "recipientCode": "RCP_3qz2s2xdw8t7qat", // Optional - if not provided, bank details required
      "bankCode": "guaranty-trust-bank", // Required if recipientCode not provided
      "accountNumber": "0123456789", // Required if recipientCode not provided
      "accountName": "John Doe" // Optional but recommended
    },
    {
      "invoiceId": "607f1f77bcf86cd799439012",
      "recipientName": "Jane Smith",
      "recipientEmail": "jane.smith@example.com",
      "bankCode": "access-bank",
      "accountNumber": "0987654321",
      "accountName": "Jane Smith"
    }
  ],
  "currency": "NGN", // Optional, defaults to NGN
  "source": "balance", // Optional, defaults to balance
  "metadata": { // Optional
    "batch_description": "Monthly payments Q1 2026",
    "admin_notes": "Bulk transfer for completed projects"
  }
}
```

---

## Key Features

### 🔄 Automatic Currency Conversion
- Fetches invoices containing USD amounts
- Uses Exchange Rate API with `EXCHANGE_RATES_API_KEY`
- Converts USD to NGN in real-time
- Caches exchange rates (1-hour TTL)

### ⚡ Double Payment Prevention
- Validates invoice payment status before processing
- Rejects transfers for already paid invoices
- Returns specific error for paid invoices

### 📝 Complete Audit Trail
- Creates FreelancerPaymentModel records
- Links payments to invoices and projects
- Stores original USD amount and exchange rate used
- Tracks conversion timestamp and batch information

### 🏦 Flexible Bank Details
- Supports existing Paystack recipient codes
- Can create new recipients using bank details
- Validates required fields per transfer type

---

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "Bulk transfer completed successfully. 2 invoices paid.",
  "data": {
    "batchId": "bulk_transfer_invoice_1729234567890_abc123def",
    "paystackBatchId": "PSK_batch_67890",
    "transferCode": "TRF_1234567890",
    "summary": {
      "totalTransfers": 2,
      "successfulTransfers": 2,
      "totalUSDAmount": "500.00",
      "totalNGNAmount": "825000.00",
      "exchangeRateUsed": "1650.00",
      "conversionDate": "2026-02-25T10:30:00.000Z"
    },
    "paidInvoices": [
      {
        "invoiceId": "607f1f77bcf86cd799439011",
        "invoiceNumber": "INV-2026-001",
        "recipient": "John Doe",
        "usdAmount": 250.00,
        "ngnAmount": 412500.00,
        "status": "paid"
      },
      {
        "invoiceId": "607f1f77bcf86cd799439012", 
        "invoiceNumber": "INV-2026-002",
        "recipient": "Jane Smith",
        "usdAmount": 250.00,
        "ngnAmount": 412500.00,
        "status": "paid"
      }
    ],
    "paystackResponse": {
      "status": true,
      "message": "Bulk transfer initiated",
      "reference": "TRF_xyz789"
    }
  }
}
```

### Error Responses

#### Already Paid Invoices (400)
```json
{
  "success": false,
  "message": "Some invoices are already paid. Cannot process double payments.",
  "statusCode": 400,
  "details": {
    "alreadyPaidInvoices": ["INV-2026-001", "INV-2026-003"]
  }
}
```

#### Exchange Rate Service Failure (503)
```json
{
  "success": false,
  "message": "Cannot process transfers due to exchange rate service failure",
  "statusCode": 503,
  "error": "Exchange rate service unavailable",
  "details": {
    "exchangeRateError": "API key not set or API failure",
    "message": "Please try again later or contact support if the issue persists"
  }
}
```

#### Missing Invoice IDs (404)
```json
{
  "success": false,
  "message": "Some invoice IDs were not found",
  "statusCode": 404,
  "details": {
    "missingInvoiceIds": ["607f1f77bcf86cd799439999"]
  }
}
```

#### Validation Errors (400)
```json
{
  "success": false,
  "message": "Validation errors in transfers",
  "statusCode": 400,
  "details": [
    "Transfer 1: invoiceId is required",
    "Transfer 2: Either recipientCode or valid bank details required",
    "Transfer 3: recipientEmail is required"
  ]
}
```

---

## Database Impact

### FreelancerPaymentModel Updates
Each successful transfer creates a new payment record with:
- **Amount**: NGN converted amount
- **Currency**: 'NGN'
- **Payment Type**: 'bulk_transfer'
- **Metadata**: Original USD amount, exchange rate, batch info
- **Status**: 'processing' → 'success'

### Invoice Updates
Each paid invoice gets:
- **Payment Status**: 'paid'
- **Payment Method**: 'bulk_transfer'
- **Payment Reference**: Unique transaction reference
- **Payment Notes**: Batch ID and conversion information

---

## Environment Requirements

### Required Environment Variables
```bash
EXCHANGE_RATES_API_KEY=your_exchange_rate_api_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key
```

### API Dependencies
- **Exchange Rates API**: `exchangeratesapi.io`
- **Paystack API**: Bulk transfer endpoint
- **Database**: MongoDB with Invoice and DTUser collections

---

## Usage Examples

### Frontend Integration (React/JavaScript)
```javascript
const processInvoiceTransfers = async (transfers) => {
  try {
    const response = await fetch('/api/payments/transfer/bulk-invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transfers })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Transfers completed:', result.data.summary);
      console.log('💰 Total processed:', `$${result.data.summary.totalUSDAmount} → ₦${result.data.summary.totalNGNAmount}`);
      return result.data;
    } else {
      console.error('❌ Transfer failed:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Transfer error:', error);
    throw error;
  }
};
```

### curl Example
```bash
curl -X POST http://localhost:3000/api/payments/transfer/bulk-invoices \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "transfers": [
      {
        "invoiceId": "607f1f77bcf86cd799439011",
        "recipientName": "John Doe",
        "recipientEmail": "john@example.com",
        "bankCode": "guaranty-trust-bank", 
        "accountNumber": "0123456789"
      }
    ]
  }'
```

---

## Limitations & Best Practices

### Rate Limits
- **Maximum**: 100 transfers per request
- **Recommended**: Process in batches of 20-50 for optimal performance

### Error Handling
- Always check for already paid invoices before processing
- Handle exchange rate failures with proper user feedback
- Implement retry logic for network timeouts

### Security Considerations
- Admin authentication required for all operations
- Payment records include complete audit trail
- Bank details validated before transfer initiation
- Duplicate invoice protection prevents double payments

### Performance Tips
- Exchange rates are cached for 1 hour to reduce API calls
- Use recipient codes when available to skip bank validation
- Process during low-traffic periods for best results

---

## Support and Troubleshooting

### Common Issues
1. **Exchange Rate Failures**: Check API key and network connectivity
2. **Invalid Bank Codes**: Ensure bank codes match Paystack's format
3. **Paid Invoice Errors**: Verify invoice status before transfer
4. **Authentication Errors**: Confirm admin token validity

### Logging
All operations are logged with:
- Batch ID for tracking
- Exchange rate conversions
- Paystack responses
- Error details for debugging

For support, contact the development team with the batch ID for faster resolution.