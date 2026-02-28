# Freelancer Payment System Documentation

## Overview
This document describes the comprehensive Paystack payment integration for processing freelancer payments in the MyDeepTech application.

## Features
- ✅ Payment initialization with Paystack
- ✅ Payment verification and status tracking
- ✅ Webhook handling for real-time updates
- ✅ Payment analytics and statistics
- ✅ Support for multiple currencies (NGN, USD, GHS, KES, ZAR)
- ✅ Payment cancellation and refund tracking
- ✅ Comprehensive error handling and validation
- ✅ Admin dashboard for payment management
- ✅ Freelancer and project-specific payment tracking

## Architecture

### Database Model
**File:** `models/freelancerPayment.model.js`
- Stores complete payment transaction information
- Tracks payment status through lifecycle
- Includes Paystack integration data
- Supports refund tracking and audit trails

### Repository Layer
**File:** `repositories/freelancerPayment.repository.js`
- Provides data access methods
- Handles complex queries for analytics
- Includes pagination and search functionality

### Service Layer
**File:** `services/paystack-payment.service.ts`
- Contains business logic for payment processing
- Integrates with Paystack API
- Handles webhook processing and payment verification

### Controller Layer
**File:** `controllers/paystack-payment.controller.js`
- HTTP request handlers
- Input validation and response formatting
- Error handling and logging

### Validation Layer
**File:** `validations/freelancerPayment.validation.js`
- Request validation using Joi
- Schema validation for all endpoints
- Custom validation rules

### Routes
**File:** `routes/freelancerPayment.routes.js`
- RESTful API endpoints
- Authentication and authorization middleware
- Rate limiting and security headers

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxx  # Your Paystack secret key
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxx  # Your Paystack public key (for frontend)

# Frontend Configuration
FRONTEND_URL=http://localhost:3000  # Your frontend URL for payment callbacks

# Optional: Webhook Configuration
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret  # If you want custom webhook verification
```

## API Endpoints

### Payment Initialization
```http
POST /api/payments/initialize
```

**Request Body:**
```json
{
  "freelancerId": "60d0fe4f5311236168a109ca",
  "projectId": "60d0fe4f5311236168a109cb",
  "invoiceId": "60d0fe4f5311236168a109cc", // Optional
  "amount": 50000.00,
  "currency": "NGN",
  "customerEmail": "freelancer@example.com",
  "customerName": "John Doe",
  "customerPhone": "+2348012345678", // Optional
  "description": "Payment for project completion",
  "callbackUrl": "https://yourapp.com/payment/callback" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "payment": {
      "paymentReference": "FLP_ABC123_DEF456",
      "amount": 5000000,
      "currency": "NGN",
      "status": "processing",
      // ... other payment details
    },
    "paystack": {
      "authorization_url": "https://checkout.paystack.com/xyz",
      "access_code": "abc123def456",
      "reference": "FLP_ABC123_DEF456"
    }
  }
}
```

### Payment Verification
```http
GET /api/payments/verify/:reference
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment": {
      "paymentReference": "FLP_ABC123_DEF456",
      "status": "success",
      "completedAt": "2024-02-24T10:30:00Z",
      // ... payment details
    },
    "paystackData": {
      "status": "success",
      "gateway_response": "Successful",
      "channel": "card"
      // ... paystack response data
    }
  }
}
```

### Webhook Handling
```http
POST /api/payments/webhook
```
- Automatically handles Paystack webhooks
- Verifies webhook signatures
- Updates payment status in real-time

### Get Payment Details
```http
GET /api/payments/:paymentId
```

### Get Freelancer Payments
```http
GET /api/payments/freelancer/:freelancerId?page=1&limit=10&status=success
```

### Get Project Payments
```http
GET /api/payments/project/:projectId?page=1&limit=10
```

### Admin Endpoints
```http
GET /api/payments/admin/all?page=1&limit=10&search=John
GET /api/payments/admin/pending
GET /api/payments/admin/failed
GET /api/payments/admin/successful
GET /api/payments/admin/stats?startDate=2024-01-01&endDate=2024-12-31
```

### Cancel Payment
```http
PUT /api/payments/:paymentId/cancel
```

**Request Body:**
```json
{
  "reason": "Payment cancelled by user request"
}
```

## Usage Examples

### Frontend Integration
```javascript
// Initialize payment
const initializePayment = async (paymentData) => {
  try {
    const response = await axios.post('/api/payments/initialize', paymentData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      // Redirect to Paystack checkout
      window.location.href = response.data.data.paystack.authorization_url;
    }
  } catch (error) {
    console.error('Payment initialization failed:', error.response.data);
  }
};

// Handle payment callback
const handlePaymentCallback = async (reference) => {
  try {
    const response = await axios.get(`/api/payments/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.data.data.payment.status === 'success') {
      // Payment successful
      showSuccessMessage('Payment completed successfully!');
    } else {
      // Payment failed
      showErrorMessage('Payment failed. Please try again.');
    }
  } catch (error) {
    console.error('Payment verification failed:', error);
  }
};
```

### Backend Service Usage
```javascript
// In your controller or service
const PaystackPaymentService = require('../services/paystack-payment.service');

// Initialize a payment
const paymentData = {
  freelancerId: '60d0fe4f5311236168a109ca',
  projectId: '60d0fe4f5311236168a109cb',
  amount: 50000,
  customerEmail: 'freelancer@example.com',
  customerName: 'John Doe',
  initiatedBy: adminUserId
};

const result = await PaystackPaymentService.initializePayment(paymentData);

// Get freelancer payments
const payments = await PaystackPaymentService.getFreelancerPayments(
  freelancerId, 
  { page: 1, limit: 10, status: 'success' }
);
```

## Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Payment initialized but not yet processed |
| `processing` | Payment is being processed by Paystack |
| `success` | Payment completed successfully |
| `failed` | Payment failed |
| `abandoned` | Payment was abandoned by user |
| `cancelled` | Payment was cancelled |

## Security Considerations

1. **Authentication**: All endpoints (except webhook) require valid authentication
2. **Authorization**: Admin endpoints require admin privileges
3. **Webhook Verification**: Webhooks are verified using Paystack signatures
4. **Input Validation**: All inputs are validated using Joi schemas
5. **Rate Limiting**: Consider implementing rate limiting for payment endpoints
6. **Audit Logging**: All payment activities are logged for audit purposes

## Testing

### Test Environment Setup
1. Use Paystack test keys for development
2. Set up test webhooks using ngrok or similar tools
3. Use test card numbers provided by Paystack

### Test Card Numbers
- **Successful Payment**: 4084084084084081
- **Declined Payment**: 5060666666666666666
- **Insufficient Funds**: 4084080000000408

## Error Handling

The API returns standardized error responses:

```json
{
  "success": false,
  "message": "Payment initialization failed",
  "errors": "Validation error details",
  "statusCode": 400
}
```

## Monitoring and Analytics

### Payment Statistics
- Track payment success rates
- Monitor failed payments and reasons
- Generate revenue reports
- Analyze payment patterns by freelancer/project

### Health Monitoring
```http
GET /api/payments/health
```

## Deployment Considerations

1. **Environment Variables**: Ensure all required environment variables are set
2. **Database Indexes**: Payment queries are optimized with proper indexes
3. **Webhook URLs**: Configure webhook URLs in Paystack dashboard
4. **SSL/TLS**: Ensure HTTPS for production webhook endpoints
5. **Error Monitoring**: Implement error monitoring for payment failures

## Support and Troubleshooting

### Common Issues

1. **Webhook Not Receiving**: Check firewall settings and webhook URL configuration
2. **Payment Verification Fails**: Ensure correct Paystack secret key
3. **Database Connection Issues**: Check MongoDB connection and indexes

### Logs
Payment activities are logged with appropriate log levels for debugging.

## Future Enhancements

1. **Multi-currency Support**: Extend to more currencies
2. **Recurring Payments**: Add support for subscription payments
3. **Payment Splits**: Implement payment splitting for multiple freelancers
4. **Refund API**: Add automated refund processing
5. **Payment Analytics Dashboard**: Build comprehensive analytics interface

## Contributing

When contributing to the payment system:

1. Follow existing code patterns
2. Add appropriate tests for new features
3. Update documentation for API changes
4. Ensure security best practices
5. Test thoroughly with Paystack test environment