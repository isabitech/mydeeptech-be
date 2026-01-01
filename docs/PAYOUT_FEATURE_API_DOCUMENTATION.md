# 💰 Payout Feature API Documentation

## Overview

The Nigerian Freelancer Payout Feature provides bulk payment processing capabilities for streamlining payments to Nigerian freelancers using Paystack integration.

## New Endpoints

### 1. Bulk Authorize Payment
**Endpoint:** `POST /api/admin/invoices/bulk-authorize-payment`  
**Description:** Authorizes all unpaid invoices as paid and sends payment confirmation emails  
**Authentication:** Admin JWT token required

#### Request:
```http
POST /api/admin/invoices/bulk-authorize-payment
Authorization: Bearer <admin_token>
Content-Type: application/json
```

#### Response:
```json
{
  "success": true,
  "message": "Bulk payment authorization completed",
  "data": {
    "processedInvoices": 25,
    "totalAmount": 12750.50,
    "emailsSent": 23,
    "errors": [
      {
        "invoiceNumber": "INV-20260101-0001",
        "error": "Email sending failed",
        "details": "Network timeout"
      }
    ]
  }
}
```

### 2. Generate Paystack CSV
**Endpoint:** `GET /api/admin/invoices/generate-paystack-csv`  
**Description:** Generates Paystack-compatible CSV for bulk transfers to Nigerian freelancers  
**Authentication:** Admin JWT token required

#### Request:
```http
GET /api/admin/invoices/generate-paystack-csv
Authorization: Bearer <admin_token>
```

#### Response:
```json
{
  "success": true,
  "message": "Paystack CSV generated successfully",
  "data": {
    "csvContent": "Transfer Amount,Transfer Note (Optional),...",
    "summary": {
      "totalInvoices": 50,
      "nigerianFreelancers": 25,
      "totalAmountUSD": 12750.50,
      "totalAmountNGN": 21421840.00,
      "errors": []
    }
  }
}
```

#### Error Response (Exchange Rate Service Failure):
```json
{
  "success": false,
  "message": "Cannot generate CSV due to exchange rate service failure",
  "error": "Exchange rate service unavailable",
  "details": {
    "exchangeRateError": "Exchange rate service unavailable: EXCHANGE_RATES_API_KEY environment variable is not set",
    "totalInvoices": 50,
    "message": "Please try again later or contact support if the issue persists"
  }
}
```

## CSV Format

The generated CSV follows Paystack's bulk transfer format:

| Field | Description | Example |
|-------|-------------|---------|
| Transfer Amount | Amount in NGN | 85000.00 |
| Transfer Note | Description for the transfer | "Project completion payment for John Doe" |
| Transfer Reference | Invoice number | "INV-20260101-0001" |
| Recipient Code | Left empty (optional) | "" |
| Bank Code or Slug | Paystack bank code | "access-bank" |
| Account Number | Recipient's account number | "0123456789" |
| Account Name | Recipient's account name | "John Doe" |
| Email Address | Recipient's email | "john@example.com" |

## Exchange Rate Integration

- Uses `exchangeratesapi.io` with API key authentication for real-time USD/NGN conversion
- Implements caching (1-hour TTL) to reduce API calls
- **No fallback rate** - API failures cause CSV generation to fail with detailed error response
- Logs all conversion operations for audit trail
- Requires `EXCHANGE_RATES_API_KEY` environment variable

### API Configuration:
```bash
EXCHANGE_RATES_API_KEY=your_api_key_here
```

### API Endpoint Used:
```
GET https://api.exchangeratesapi.io/v1/convert?from=USD&to=NGN&amount=1&access_key=API_KEY
```

## Bank Code Mapping

Supports the following Nigerian banks:

- Access Bank (`access-bank`)
- Fidelity Bank (`fidelity-bank`)
- First Bank of Nigeria (`first-bank-of-nigeria`)
- Guaranty Trust Bank (`guaranty-trust-bank`)
- United Bank for Africa (`united-bank-for-africa`)
- Zenith Bank (`zenith-bank`)
- Ecobank Nigeria (`ecobank-nigeria`)
- Union Bank of Nigeria (`union-bank-of-nigeria`)
- Stanbic IBTC Bank (`stanbic-ibtc-bank`)
- Sterling Bank (`sterling-bank`)
- Wema Bank (`wema-bank`)
- Polaris Bank (`polaris-bank`)
- Kuda Bank (`kuda-bank`)
- VFD Microfinance Bank (`vfd`)
- Opay (`paycom`)
- PalmPay (`palmpay`)
- Moniepoint (`moniepoint-mfb-ng`)

## DTUser Model Updates

### New Field: `bank_code`
Added to `payment_info` schema for Paystack integration:

```javascript
payment_info: {
  account_name: String,
  account_number: String,
  bank_name: String,
  bank_code: String, // NEW: For Paystack integration
  payment_method: String,
  payment_currency: String
}
```

## Profile Update API Changes

The DTUser profile update endpoint now accepts `bank_code`:

```json
{
  "paymentInfo": {
    "accountName": "John Doe",
    "accountNumber": "0123456789",
    "bankName": "Access Bank",
    "bankCode": "access-bank",
    "paymentMethod": "bank_transfer",
    "paymentCurrency": "NGN"
  }
}
```

## Error Handling

### Common Error Scenarios:
1. **Invalid Payment Info**: Missing account details or unsupported bank
2. **Exchange Rate API Failure**: CSV generation fails with detailed error (no fallback)
3. **Missing API Key**: Exchange rate service fails if `EXCHANGE_RATES_API_KEY` not set
4. **Email Delivery Failure**: Continues processing, logs errors (bulk authorization only)
5. **Non-Nigerian Users**: Skipped from CSV generation

### Error Response Format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Security Considerations

- All endpoints require admin authentication
- Bulk operations are logged with admin details
- Payment info validation prevents invalid data
- CSV generation filters only Nigerian users
- Exchange rate caching reduces external API dependencies

## Implementation Notes

### Prerequisites:
- Nigerian users must have `personal_info.country` set to "Nigeria" or "NG"
- Users must have complete payment information including bank details
- Bank names should match supported Nigerian banks list
- **Required**: `EXCHANGE_RATES_API_KEY` environment variable must be set
- Exchange rate API must be accessible and functional

### Performance:
- Bulk operations use efficient aggregation queries
- Exchange rate caching reduces API calls
- Error handling allows partial success scenarios
- CSV generation streams large datasets

## Testing

### Test Scenarios:
1. Process invoices with mixed user countries
2. Handle users with incomplete payment info
3. Test exchange rate API failure scenarios  
4. Verify email delivery error handling
5. Generate CSV with various bank types

### Sample Test Data:
```javascript
// Nigerian user with complete payment info
{
  personal_info: { country: "Nigeria" },
  payment_info: {
    account_name: "John Doe",
    account_number: "0123456789", 
    bank_name: "Access Bank",
    bank_code: "access-bank"
  }
}
```

---

*Feature implemented: January 1, 2026*  
*Version: 1.0.0*