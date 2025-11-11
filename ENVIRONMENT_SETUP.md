# 🔧 Environment Variables Configuration for Brevo Fix

## 📋 Required Environment Variables

Add these variables to your **Render Environment Variables** settings:

### 🔑 **Brevo API Configuration (Primary)**
```bash
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=info@mydeeptech.ng
BREVO_SENDER_NAME=MyDeepTech Team
BREVO_PROJECT_SENDER_EMAIL=projects@mydeeptech.ng
BREVO_PROJECT_SENDER_NAME=MyDeepTech Projects
```

### 📧 **Brevo SMTP Configuration (Fallback)**
```bash
SMTP_LOGIN=your_brevo_smtp_login
SMTP_KEY=your_brevo_smtp_password
SMTP_SERVER=smtp-relay.brevo.com
SMTP_PORT=587
```

## 🏃‍♂️ **Quick Setup Steps**

### 1. **Get Your Brevo API Key**
1. Login to your Brevo account
2. Go to **Settings → API Keys**
3. Create a new API key or copy existing one
4. Set `BREVO_API_KEY=xkeysib-xxx...`

### 2. **Get Your Brevo SMTP Credentials**
1. In Brevo, go to **Settings → SMTP & API**
2. Copy your SMTP login and password
3. Set `SMTP_LOGIN` and `SMTP_KEY`

### 3. **Configure Sender Emails**
Make sure these emails are verified in your Brevo account:
- `info@mydeeptech.ng` (general emails)
- `projects@mydeeptech.ng` (project-related emails)
- `payments@mydeeptech.ng` (payment emails)

## 🚀 **Render Deployment Setup**

### **Option A: Using Render Dashboard**
1. Go to your Render service dashboard
2. Click **Environment** tab
3. Add each variable manually:
   - Key: `BREVO_API_KEY`
   - Value: `your_actual_api_key`
   - Click **Save Changes**

### **Option B: Using Render Environment File**
If you have a `.env` file in your repository (not recommended for production):
```bash
# Add to your .env file (LOCAL TESTING ONLY)
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxx
BREVO_SENDER_EMAIL=info@mydeeptech.ng
BREVO_SENDER_NAME=MyDeepTech Team
BREVO_PROJECT_SENDER_EMAIL=projects@mydeeptech.ng
BREVO_PROJECT_SENDER_NAME=MyDeepTech Projects
SMTP_LOGIN=your_brevo_email@gmail.com
SMTP_KEY=your_brevo_smtp_password
SMTP_SERVER=smtp-relay.brevo.com
SMTP_PORT=587
```

## 🧪 **Testing After Configuration**

Once you've added the environment variables to Render:

1. **Redeploy your service** (Render will pick up new env vars)
2. **Test the admin creation** that was failing
3. **Check logs** for success messages:
   ```
   ✅ Brevo API email sent to projects@mydeeptech.ng messageId
   ```

## 🔍 **Verification Checklist**

- [ ] Brevo API key is valid and active
- [ ] Sender emails are verified in Brevo
- [ ] Environment variables are added to Render
- [ ] Service has been redeployed
- [ ] Domain emails (mydeeptech.ng) are configured in Brevo

## 🎯 **Expected Results**

After proper configuration:
1. ✅ No more "Connection timeout" errors
2. ✅ Admin verification emails send successfully
3. ✅ All email functions use reliable Brevo API
4. ✅ Automatic fallback to SMTP if API temporarily fails

## 🚨 **Troubleshooting**

If emails still fail after configuration:

### **Check Brevo Account:**
- Account has sufficient email credits
- API key has sending permissions
- Sender emails are verified
- Domain authentication is configured

### **Check Render Logs:**
```bash
# Look for these patterns:
✅ Brevo API email sent to user@example.com messageId
⚠️ Brevo API failed, trying SMTP fallback...
❌ Both Brevo API and SMTP failed
```

### **Common Issues:**
- **Invalid API key**: Check key format and permissions
- **Unverified sender**: Verify sender emails in Brevo
- **Rate limiting**: Check if you've exceeded daily limits
- **Domain issues**: Ensure mydeeptech.ng domain is configured

Once configured properly, your email system will be much more reliable on Render! 🚀