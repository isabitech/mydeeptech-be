# 💰 Nigerian Freelancer Payout Feature - Frontend Integration Guide

## Overview

This document provides frontend developers with the necessary information to integrate the Nigerian Freelancer Payout Feature into the admin dashboard.

## New Admin Features

### 1. Bulk Payment Authorization
Allows admins to authorize all unpaid invoices as paid and send confirmation emails to freelancers.

### 2. Paystack CSV Generation
Generates a CSV file compatible with Paystack bulk transfer format for Nigerian freelancers with real-time USD to NGN conversion.

---

## API Endpoints

### 1. Bulk Authorize Payment

**Endpoint:** `POST /api/admin/invoices/bulk-authorize-payment`
**Authentication:** Admin JWT token required
**Description:** Authorizes all unpaid invoices and sends payment confirmation emails

#### Request
```javascript
const response = await fetch('/api/admin/invoices/bulk-authorize-payment', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
```

#### Success Response (200)
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

#### Error Response (500)
```json
{
  "success": false,
  "message": "Server error during bulk payment authorization",
  "error": "Detailed error message"
}
```

### 2. Generate Paystack CSV

**Endpoint:** `GET /api/admin/invoices/generate-paystack-csv`
**Authentication:** Admin JWT token required
**Description:** Generates Paystack-compatible CSV for Nigerian freelancers

#### Query Parameters:
- `invoiceIds[]` (optional): Array of specific invoice IDs to process

#### Request Examples:

```javascript
// Option 1: Generate CSV for all unpaid invoices
const response = await fetch('/api/admin/invoices/generate-paystack-csv', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

// Option 2: Generate CSV for specific invoices
const selectedInvoiceIds = [
  '6954196ee8b6e6a840c52acc',
  '694bce86d3d84f0a1647cccb'
];

const params = new URLSearchParams();
selectedInvoiceIds.forEach(id => {
  params.append('invoiceIds[]', id);
});

const response = await fetch(`/api/admin/invoices/generate-paystack-csv?${params.toString()}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const result = await response.json();
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Paystack CSV generated successfully",
  "data": {
    "csvContent": "Transfer Amount,Transfer Note (Optional),...",
    "summary": {
      "totalInvoices": 50,
      "selectedInvoices": 4,
      "nigerianFreelancers": 25,
      "totalAmountUSD": 12750.50,
      "totalAmountNGN": 21421840.00,
      "errors": []
    }
  }
}
```

#### Exchange Rate Service Error (503)
```json
{
  "success": false,
  "message": "Cannot generate CSV due to exchange rate service failure",
  "error": "Exchange rate service unavailable",
  "details": {
    "exchangeRateError": "API key not set or API failure",
    "totalInvoices": 50,
    "message": "Please try again later or contact support if the issue persists"
  }
}
```

---

## Frontend Implementation

### 1. Admin Dashboard Integration

Add these features to the admin invoice management section:

```jsx
// React example
import { useState } from 'react';

const PayoutFeatures = ({ adminToken }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Bulk Payment Authorization
  const handleBulkAuthorization = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/invoices/bulk-authorize-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setResult({
          type: 'success',
          title: 'Bulk Payment Authorization Completed',
          message: `Processed ${data.data.processedInvoices} invoices totaling $${data.data.totalAmount}. ${data.data.emailsSent} emails sent.`,
          errors: data.data.errors
        });
      } else {
        setResult({
          type: 'error',
          title: 'Authorization Failed',
          message: data.message
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        title: 'Network Error',
        message: 'Failed to process bulk authorization'
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate and Download CSV (with optional invoice selection)
  const handleCSVGeneration = async (selectedInvoiceIds = null) => {
    setLoading(true);
    try {
      let url = '/api/admin/invoices/generate-paystack-csv';
      
      // If specific invoices are selected, add query parameters
      if (selectedInvoiceIds && selectedInvoiceIds.length > 0) {
        const params = new URLSearchParams();
        selectedInvoiceIds.forEach(id => {
          params.append('invoiceIds[]', id);
        });
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        // Download CSV file
        const blob = new Blob([data.data.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `paystack-bulk-transfer-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        const summary = data.data.summary;
        const selectionText = summary.selectedInvoices > 0 ? 
          ` (${summary.selectedInvoices} selected)` : ' (all unpaid)';
        
        setResult({
          type: 'success',
          title: 'CSV Generated Successfully',
          message: `Generated for ${summary.nigerianFreelancers} Nigerian freelancers${selectionText}. Total: $${summary.totalAmountUSD} (₦${summary.totalAmountNGN})`,
          errors: summary.errors
        });
      } else {
        setResult({
          type: 'error',
          title: 'CSV Generation Failed',
          message: data.message,
          details: data.details
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        title: 'Network Error',
        message: 'Failed to generate CSV'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payout-features">
      <h3>Nigerian Freelancer Payouts</h3>
      
      <div className="action-buttons">
        <button 
          onClick={handleBulkAuthorization}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Processing...' : 'Authorize All Payments'}
        </button>
        
        <button 
          onClick={() => handleCSVGeneration()} // Generate for all unpaid invoices
          disabled={loading}
          className="btn btn-success"
        >
          {loading ? 'Generating...' : 'Download All Unpaid CSV'}
        </button>
        
        <button 
          onClick={() => handleCSVGeneration(selectedInvoiceIds)} // Generate for selected invoices
          disabled={loading || !selectedInvoiceIds?.length}
          className="btn btn-info"
        >
          {loading ? 'Generating...' : `Download Selected CSV (${selectedInvoiceIds?.length || 0})`}
        </button>
      </div>

      {result && (
        <div className={`result ${result.type}`}>
          <h4>{result.title}</h4>
          <p>{result.message}</p>
          
          {result.errors && result.errors.length > 0 && (
            <div className="errors">
              <h5>Issues encountered:</h5>
              <ul>
                {result.errors.map((error, index) => (
                  <li key={index}>
                    Invoice {error.invoiceNumber}: {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {result.details && (
            <div className="details">
              <p><strong>Details:</strong> {result.details.message}</p>
              <p><small>Error: {result.details.exchangeRateError}</small></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### 2. User Interface Guidelines

#### Bulk Payment Authorization
- **Button Label**: "Authorize All Payments" or "Process Bulk Payments"
- **Confirmation Dialog**: Show confirmation before processing
- **Loading State**: Display processing indicator
- **Success Feedback**: Show summary of processed invoices and emails sent
- **Error Handling**: Display any email delivery failures

#### CSV Generation
- **Button Label**: "Download Paystack CSV" or "Generate Transfer CSV"
- **Loading State**: "Generating CSV..." indicator
- **Success Action**: Automatically download the CSV file
- **Summary Display**: Show number of freelancers, total amounts (USD & NGN)
- **Error Handling**: Special handling for exchange rate service failures

### 3. Permission Checks

Ensure only authorized admin users can access these features:

```javascript
// Check admin permissions
const hasPayoutPermissions = (user) => {
  return user.role === 'admin' && 
         user.permissions.includes('manage_payments');
};

// Conditional rendering
{hasPayoutPermissions(currentUser) && (
  <PayoutFeatures adminToken={adminToken} />
)}
```

---

## User Experience Flow

### 1. Bulk Payment Authorization Flow

```
1. Admin clicks "Authorize All Payments"
2. Show confirmation dialog: "This will mark all unpaid invoices as paid and send confirmation emails. Continue?"
3. Display loading state with progress indicator
4. Show success summary:
   - "✅ Processed 25 invoices totaling $12,750.50"
   - "📧 23 payment confirmations sent"
   - List any email delivery failures
5. Refresh invoice list to reflect changes
```

### 2. CSV Generation Flow

```
1. Admin clicks "Download Paystack CSV"
2. Show loading state: "Generating CSV with real-time exchange rates..."
3. On success:
   - Auto-download CSV file
   - Show summary: "✅ CSV generated for 15 Nigerian freelancers"
   - Display totals: "$5,420.75 USD → ₦7,832,456.23 NGN"
4. On exchange rate failure:
   - Show error: "⚠️ Exchange rate service unavailable"
   - Provide retry option
   - Suggest contacting support
```

---

## Error Handling

### Common Error Scenarios

1. **Network Errors**
   ```javascript
   // Handle network failures
   catch (error) {
     showNotification({
       type: 'error',
       title: 'Connection Failed',
       message: 'Please check your internet connection and try again'
     });
   }
   ```

2. **Authentication Errors (401)**
   ```javascript
   if (response.status === 401) {
     // Redirect to login or refresh token
     redirectToLogin();
   }
   ```

3. **Exchange Rate Service Failures (503)**
   ```javascript
   if (response.status === 503) {
     showNotification({
       type: 'warning',
       title: 'Service Temporarily Unavailable',
       message: 'Exchange rate service is currently unavailable. Please try again in a few minutes.',
       action: 'retry'
     });
   }
   ```

---

## CSS Styling Suggestions

```css
.payout-features {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.action-buttons {
  display: flex;
  gap: 15px;
  margin: 15px 0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
}

.result.success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
  padding: 15px;
  border-radius: 5px;
  margin-top: 15px;
}

.result.error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
  padding: 15px;
  border-radius: 5px;
  margin-top: 15px;
}

.errors ul {
  margin: 10px 0 0 20px;
}
```

---

## Testing

### Manual Testing Checklist

- [ ] Bulk authorization with unpaid invoices
- [ ] Bulk authorization with no unpaid invoices
- [ ] CSV generation with Nigerian freelancers
- [ ] CSV generation with no eligible users
- [ ] Error handling for network failures
- [ ] Error handling for authentication failures
- [ ] Error handling for exchange rate service failures
- [ ] File download functionality
- [ ] Loading states display correctly
- [ ] Success/error messages display properly

### Test Data Requirements

For testing, ensure the database has:
- Unpaid invoices for Nigerian users
- Users with `personal_info.country` set to "Nigeria"
- Complete payment information including bank details
- Mix of supported and unsupported banks

---

## Security Considerations

1. **Admin Authentication**: Always verify admin token before API calls
2. **Permission Checks**: Ensure user has payment management permissions
3. **Sensitive Data**: Don't log sensitive payment information in browser console
4. **HTTPS Only**: Ensure all API calls use HTTPS in production
5. **Token Refresh**: Handle token expiration gracefully

---

## Browser Compatibility

- **File Download**: Uses Blob API (IE 10+, all modern browsers)
- **Fetch API**: Use polyfill for older browsers or axios
- **Async/Await**: Use Babel transpilation for older browsers

---

*Feature Version: 1.0.0*  
*Last Updated: January 1, 2026*