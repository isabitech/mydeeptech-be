# Mailjet Email Implementation Guide

This document explains how to use the Mailjet email service implementation in the MyDeepTech backend.

## 🚀 Getting Started

### Environment Variables

Add these variables to your `.env` file:

```env
# Mailjet Configuration
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_SECRET_KEY=your_mailjet_secret_key
MAILJET_SENDER_EMAIL=noreply@mydeeptech.ng
MAILJET_SENDER_NAME=MyDeepTech
```

### Obtaining Mailjet Credentials

1. Sign up at [Mailjet](https://www.mailjet.com/)
2. Go to [API Key Management](https://app.mailjet.com/account/api_keys)
3. Copy your API Key and Secret Key
4. Add them to your environment variables

## 📧 Available Functions

### 1. Email Verification

```javascript
const { sendVerificationEmailMailjet } = require('../utils/mail-jet');

// Send verification email
const result = await sendVerificationEmailMailjet(
  'user@example.com',  // recipient email
  'John Doe',          // recipient name
  'userId123'          // user ID for verification
);

console.log(result);
// Output: { success: true, messageId: 'xxx', status: 'success', service: 'mailjet' }
```

### 2. Password Reset

```javascript
const { sendPasswordResetEmailMailjet } = require('../utils/mail-jet');

// Send password reset email
const result = await sendPasswordResetEmailMailjet(
  'user@example.com',  // recipient email
  'John Doe',          // recipient name
  'resetToken123'      // password reset token
);
```

### 3. Generic Email Sending

```javascript
const { sendEmailMailjet } = require('../utils/mail-jet');

// Send custom email
const result = await sendEmailMailjet({
  to: { Email: 'user@example.com', Name: 'John Doe' },
  subject: 'Welcome to MyDeepTech!',
  htmlContent: '<h1>Welcome!</h1><p>Thanks for joining us.</p>',
  textContent: 'Welcome! Thanks for joining us.',
  from: { Email: 'custom@mydeeptech.ng', Name: 'MyDeepTech Team' }, // optional
  attachments: [ // optional
    {
      ContentType: 'application/pdf',
      Filename: 'document.pdf',
      Base64Content: 'base64_encoded_file_content'
    }
  ]
});
```

### 4. Bulk Email Sending

```javascript
const { sendEmailMailjet } = require('../utils/mail-jet');

// Send to multiple recipients
const result = await sendEmailMailjet({
  to: [
    { Email: 'user1@example.com', Name: 'John Doe' },
    { Email: 'user2@example.com', Name: 'Jane Smith' }
  ],
  subject: 'Newsletter Update',
  htmlContent: '<h1>Monthly Newsletter</h1><p>Here are the latest updates...</p>',
  textContent: 'Monthly Newsletter - Here are the latest updates...'
});
```

## 🔗 Webhook Setup (Real-time Events)

### Setting up webhooks in your main app file:

```javascript
// In your main index.js or app.js
const express = require('express');
const { setupMailjetWebhook } = require('./utils/mail-jet');

const app = express();

// Setup Mailjet webhook endpoint
setupMailjetWebhook(app);

// Your other routes and middleware...
app.listen(4000, () => {
  console.log('Server running on port 4000');
});
```

### Configuring Webhook in Mailjet Dashboard

1. Log in to your [Mailjet account](https://app.mailjet.com/)
2. Go to **Account Settings** → **Event notifications (webhooks)**
3. Add a new webhook endpoint: `https://your-domain.com/webhooks/mailjet`
4. Select the events you want to track:
   - `sent` - Email was sent successfully
   - `open` - Email was opened
   - `click` - Link in email was clicked
   - `bounce` - Email bounced
   - `spam` - Email was marked as spam
   - `unsub` - User unsubscribed
   - `blocked` - Email was blocked

### Webhook Events Handled

The webhook endpoint automatically logs all events and handles:

- **sent**: Confirmation that email was delivered to Mailjet
- **open**: Track when recipients open emails  
- **click**: Track link clicks with URLs
- **bounce**: Handle delivery failures with error details
- **spam**: Track spam reports
- **unsub**: Handle unsubscribe requests
- **blocked**: Track blocked emails with reasons

## 🔧 Integration with Existing Code

### Replacing current email service calls:

```javascript
// In your controllers/dtUser.controller.js
const { sendVerificationEmailMailjet } = require("../utils/mail-jet");

// Replace existing email call with:
const emailResult = await sendVerificationEmailMailjet(
  savedUser.email,
  savedUser.fullName,
  savedUser._id
);
```

### Error handling pattern:

```javascript
try {
  const result = await sendVerificationEmailMailjet(email, name, userId);
  console.log('Email sent successfully:', result);
} catch (error) {
  console.error('Email sending failed:', error.message);
  // Fallback to another email service or handle error
}
```

## 📊 Monitoring and Analytics

### Log Analysis

All Mailjet operations are logged with structured data:

```javascript
// Success logs include:
{
  messageId: "xxx",
  status: "success", 
  service: "mailjet",
  recipient: "user@example.com"
}

// Error logs include:
{
  error: "API error message",
  service: "mailjet",
  operation: "send_verification_email"
}
```

### Mailjet Dashboard Analytics

Monitor email performance in the [Mailjet Dashboard](https://app.mailjet.com/):
- Delivery rates
- Open rates  
- Click-through rates
- Bounce rates
- Spam reports

## 🛡️ Security Best Practices

1. **Environment Variables**: Never commit API keys to version control
2. **Webhook Security**: Consider adding webhook signature verification
3. **Rate Limiting**: Implement rate limiting for the webhook endpoint
4. **Email Validation**: Validate email addresses before sending
5. **Content Sanitization**: Sanitize HTML content to prevent XSS

## 🚨 Error Handling

The implementation includes comprehensive error handling:

```javascript
// Common error scenarios:
try {
  const result = await sendEmailMailjet(options);
} catch (error) {
  if (error.message.includes('API key')) {
    // Handle authentication errors
  } else if (error.message.includes('rate limit')) {
    // Handle rate limiting
  } else {
    // Handle other errors
  }
}
```

## 📈 Migration from Other Email Services

### From Brevo to Mailjet:

```javascript
// Old Brevo call:
await sendVerificationEmailBrevo(email, name, userId);

// New Mailjet call:
await sendVerificationEmailMailjet(email, name, userId);
```

The function signatures are identical for easy migration.

## 🔍 Testing

### Test email sending in development:

```javascript
// Create a test route in your development environment
app.get('/test-mailjet', async (req, res) => {
  try {
    const result = await sendVerificationEmailMailjet(
      'test@example.com',
      'Test User', 
      'test123'
    );
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 💡 Tips and Best Practices

1. **Template Management**: Consider using Mailjet templates for complex emails
2. **Personalization**: Use Mailjet's template variables for dynamic content
3. **A/B Testing**: Leverage Mailjet's A/B testing features
4. **Deliverability**: Monitor sender reputation and follow best practices
5. **Compliance**: Ensure GDPR and CAN-SPAM compliance

## 🆘 Troubleshooting

### Common Issues:

1. **Missing API Keys**: Check environment variables are properly set
2. **Rate Limiting**: Implement exponential backoff for retries  
3. **Bounces**: Validate email addresses and maintain clean lists
4. **Webhook Failures**: Check endpoint accessibility and response codes

### Debug Mode:

Set `NODE_ENV=development` for detailed logging of all email operations.

## 📚 Additional Resources

- [Mailjet API Documentation](https://dev.mailjet.com/email/guides/) 
- [Mailjet Node.js SDK](https://github.com/mailjet/mailjet-apiv3-nodejs)
- [Email Best Practices](https://dev.mailjet.com/email/guides/best-practices/)
- [Webhook Events](https://dev.mailjet.com/email/guides/webhooks/)