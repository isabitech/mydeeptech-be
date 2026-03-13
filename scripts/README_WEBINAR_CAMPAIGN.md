# Webinar Announcement Campaign

This folder contains scripts to send webinar announcements to all MyDeepTech users for the February 26, 2025 webinar.

## 🎯 What This Does

- Sends professional webinar announcement emails to all registered users
- Uses your existing Brevo email infrastructure  
- Includes both DTUsers and Admin users
- Deduplicates email addresses automatically
- Provides detailed success/failure reporting

## 📧 Email Details

- **From:** events@mydeeptech.ng (MyDeepTech Events)
- **Subject:** 🚀 Don't Miss Out! Exclusive Tech Webinar - Feb 26 | Register Now
- **Registration Link:** https://luma.com/v0gdp88t
- **Target Date:** February 26, 2025

## 🚀 Quick Start

### Step 1: Test the Email (RECOMMENDED)
```powershell
# Send a test email to verify everything works
node scripts/test-webinar-email.js
```

### Step 2: Preview the Email Template
```powershell
# Generate an HTML preview file you can open in browser
node scripts/test-webinar-email.js --preview
```

### Step 3: Send to All Users
```powershell
# Send announcements to all users (includes 10-second confirmation delay)
node scripts/send-webinar-announcements.js
```

## 📊 What to Expect

The script will:
1. Connect to your MongoDB database
2. Fetch all DTUsers (with verified emails only) and Admin users
3. Remove duplicate email addresses
4. Show you a summary of recipients
5. Give you 10 seconds to cancel before sending
6. Send emails with rate limiting (respects Brevo limits)
7. Provide a detailed success/failure report

## ⚠️ Important Notes

- **Test First:** Always run the test script before the full campaign
- **Rate Limiting:** Script includes delays to respect Brevo's 300 emails/hour limit
- **Deduplication:** Automatically removes duplicate emails between DTUser and Admin tables
- **Verified Only:** Only sends to DTUsers with verified email addresses
- **Confirmation:** 10-second window to cancel before sending to all users

## 🔧 Configuration

The scripts use your existing environment variables:
- `BREVO_API_KEY` - Your Brevo API key
- `MONGO_URI` - MongoDB connection string
- Sender configured as `events@mydeeptech.ng`

## 📈 Expected Output

```
🚀 MyDeepTech Webinar Announcement Campaign
══════════════════════════════════════════════════════════
📅 Webinar Date: February 26, 2025
🔗 Registration: https://luma.com/v0gdp88t
📧 From: events@mydeeptech.ng
══════════════════════════════════════════════════════════

📊 Email Summary:
├─ DTUsers found: 150 (verified email only)
├─ Admin Users found: 5
└─ Total unique emails: 155

✅ Successfully sent: 152
❌ Failed to send: 3
📊 Success rate: 98.1%
```

## 🆘 Troubleshooting

If emails fail to send:
1. Verify `BREVO_API_KEY` is valid and active
2. Check that `events@mydeeptech.ng` is verified in your Brevo account
3. Ensure you have sufficient Brevo email credits
4. Check your MongoDB connection

## 📁 Files Created

- `exports/webinar-email-preview.html` - Email template preview (when using --preview)
- Console logs with detailed sending status

## 🔒 Safety Features

- 10-second confirmation delay before mass sending
- Rate limiting to prevent API limits
- Detailed error reporting
- Only sends to verified DTUser emails
- Graceful error handling

---

**Ready to announce your webinar? Start with the test script! 🚀**