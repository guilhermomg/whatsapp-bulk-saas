# WhatsApp Cloud API Setup Guide

This guide walks you through setting up the WhatsApp Cloud API integration for the WhatsApp Bulk SaaS application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Meta Business Manager Setup](#meta-business-manager-setup)
3. [WhatsApp Business Account (WABA) Creation](#whatsapp-business-account-waba-creation)
4. [Phone Number Registration](#phone-number-registration)
5. [Obtaining Permanent Access Token](#obtaining-permanent-access-token)
6. [Test Phone Number Setup](#test-phone-number-setup)
7. [Webhook Configuration](#webhook-configuration)
8. [Environment Configuration](#environment-configuration)
9. [Testing the Integration](#testing-the-integration)

## Prerequisites

Before you begin, make sure you have:

- A Facebook Business Account
- A verified business on Meta
- A phone number that you can dedicate to WhatsApp Business API (cannot be used with regular WhatsApp)
- Administrative access to your Facebook Business Account

## Meta Business Manager Setup

1. **Access Meta Business Manager**
   - Go to [business.facebook.com](https://business.facebook.com)
   - If you don't have a Business Manager account, click "Create Account"
   - Follow the prompts to set up your business information

2. **Verify Your Business**
   - Navigate to Business Settings → Security Center
   - Complete the business verification process
   - This may require uploading business documents (business license, tax ID, etc.)
   - Verification can take 1-3 business days

3. **Create or Link a Facebook App**
   - Go to [developers.facebook.com](https://developers.facebook.com)
   - Click "My Apps" → "Create App"
   - Select "Business" as the app type
   - Fill in app details (App Name, Contact Email)
   - Link the app to your Business Manager account

## WhatsApp Business Account (WABA) Creation

1. **Add WhatsApp Product to Your App**
   - In the Facebook App Dashboard, click "Add Product"
   - Select "WhatsApp" and click "Set Up"
   - This will create a WhatsApp Business Account (WABA)

2. **Configure Business Profile**
   - Navigate to WhatsApp → Getting Started
   - Fill in your business profile information:
     - Business display name
     - Business description
     - Business category/vertical
     - Business address
     - Business website
     - Business email

3. **Note Your Business Account ID**
   - In the WhatsApp section, you'll see your WhatsApp Business Account ID
   - Save this ID - you'll need it for the `WHATSAPP_BUSINESS_ACCOUNT_ID` environment variable

## Phone Number Registration

### Option 1: Use Meta Test Number (Recommended for Development)

Meta provides a test phone number that you can use immediately for development:

1. In WhatsApp → Getting Started, you'll see a test phone number
2. Click "Add phone number" to add recipient test numbers
3. Test numbers can receive messages but cannot be used in production

### Option 2: Register Your Own Phone Number

For production use, you need to register your own phone number:

1. **Prepare Your Phone Number**
   - Must be a real phone number that can receive SMS/voice calls
   - Cannot be currently registered with WhatsApp or WhatsApp Business app
   - Must not be a virtual or VOIP number (most carriers)

2. **Add Phone Number to WABA**
   - Go to WhatsApp → API Setup
   - Click "Add Phone Number"
   - Enter your phone number with country code
   - Select "Text message" or "Voice call" for verification
   - Enter the verification code received

3. **Display Name Verification**
   - Your display name will be shown to message recipients
   - Meta may require additional verification for certain business names
   - Choose a name that clearly represents your business

4. **Note Your Phone Number ID**
   - After registration, you'll see a Phone Number ID
   - Save this ID - you'll need it for the `WHATSAPP_PHONE_NUMBER_ID` environment variable

## Obtaining Permanent Access Token

By default, Facebook provides a temporary access token that expires in 24 hours. For production, you need a permanent token:

### Step 1: Create a System User

1. Go to Business Settings → Users → System Users
2. Click "Add" to create a new system user
3. Give it a descriptive name (e.g., "WhatsApp API Production")
4. Select "Admin" role

### Step 2: Generate System User Access Token

1. Click on the system user you just created
2. Click "Generate New Token"
3. Select your Facebook App from the dropdown
4. Select the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Set token expiration to "Never"
6. Generate and save the token securely
7. This is your `WHATSAPP_ACCESS_TOKEN`

### Step 3: Assign WhatsApp Assets to System User

1. In Business Settings → Accounts → WhatsApp Accounts
2. Select your WhatsApp Business Account
3. Click "Add People" → Select your system user
4. Grant "Full control" permissions

## Test Phone Number Setup

To test message sending during development:

1. **Add Test Recipients**
   - Go to WhatsApp → API Setup → Phone Numbers
   - Under your test number, click "Manage phone number"
   - Add phone numbers that should receive test messages
   - Each number must verify via code sent by Meta

2. **Recipient Format**
   - All phone numbers must be in E.164 format
   - Example: `+14155238886` (US number)
   - Example: `+5511987654321` (Brazil number)

## Webhook Configuration

Webhooks allow WhatsApp to send you real-time notifications about message status and incoming messages.

### Step 1: Prepare Your Webhook Endpoint

1. Your webhook endpoint must be publicly accessible via HTTPS
2. For local development, use a tunneling service like [ngrok](https://ngrok.com):
   ```bash
   ngrok http 3000
   ```
3. Note the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 2: Generate Webhook Verify Token

1. Create a secure random string for your verify token:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Save this as your `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

### Step 3: Get Your App Secret

1. In your Facebook App Dashboard, go to Settings → Basic
2. Copy your "App Secret"
3. Save this as your `WHATSAPP_APP_SECRET`

### Step 4: Configure Webhook in Meta

1. In your Facebook App Dashboard, go to WhatsApp → Configuration
2. Click "Configure" under Webhooks
3. Enter your webhook URL: `https://your-domain.com/webhooks/whatsapp`
4. Enter your verify token (from Step 2)
5. Click "Verify and Save"
6. Subscribe to webhook fields:
   - `messages` - For incoming messages and status updates
7. Click "Subscribe"

## Environment Configuration

Create a `.env` file in your project root with the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# API Configuration
API_VERSION=v1
API_PREFIX=/api

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=logs

# Security
CORS_ORIGIN=*

# WhatsApp Cloud API Configuration
WHATSAPP_API_VERSION=v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id_here
WHATSAPP_ACCESS_TOKEN=your_permanent_token_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verification_token_here
WHATSAPP_APP_SECRET=your_app_secret_here
```

Replace the placeholder values with the actual values obtained from the previous steps.

## Testing the Integration

### 1. Start Your Application

```bash
npm install
npm run build
npm start
```

### 2. Test Webhook Verification

WhatsApp will automatically verify your webhook when you configure it. If you need to test manually:

```bash
curl -X GET "http://localhost:3000/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"
```

Expected response: `test_challenge`

### 3. Test Sending a Text Message

```bash
curl -X POST http://localhost:3000/api/v1/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "to": "+14155238886",
    "body": "Hello from WhatsApp Cloud API!",
    "previewUrl": false
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Text message sent successfully",
  "data": {
    "messageId": "wamid.xxx...",
    "waId": "14155238886"
  }
}
```

### 4. Test Service Health Check

```bash
curl http://localhost:3000/api/v1/whatsapp/status
```

Expected response:
```json
{
  "success": true,
  "message": "WhatsApp service is operational",
  "data": {
    "connected": true,
    "phoneNumber": {
      "displayName": "+1 415-523-8886",
      "verifiedName": "Your Business Name",
      "qualityRating": "GREEN"
    }
  }
}
```

### 5. Test Template Message (After Creating Template)

First, create a message template in Meta Business Manager:

1. Go to WhatsApp → Message Templates
2. Click "Create Template"
3. Fill in template details and submit for approval
4. Once approved, test it:

```bash
curl -X POST http://localhost:3000/api/v1/messages/send \
  -H "Content-Type: application/json" \
  -d '{
    "type": "template",
    "to": "+14155238886",
    "templateName": "hello_world",
    "languageCode": "en_US"
  }'
```

## Troubleshooting

### Common Issues

**Issue: Webhook verification fails**
- Ensure your webhook URL is publicly accessible via HTTPS
- Verify that your verify token matches exactly
- Check that your application is running and responding on the correct port

**Issue: "Invalid access token" error**
- Verify your access token hasn't expired
- Ensure you're using a System User token, not a temporary user token
- Check that the token has the required permissions

**Issue: "Phone number not registered" error**
- Complete phone number registration in Meta Business Manager
- Verify the phone number can receive SMS/calls
- Ensure the number isn't already registered with WhatsApp

**Issue: Messages not being delivered**
- Check phone number format (must be E.164)
- For test numbers, ensure recipient is added to allowed list
- Check message quality rating (goes down with spam reports)
- Verify recipient has WhatsApp installed

**Issue: Rate limit errors**
- WhatsApp has a limit of 80 requests/second per phone number
- Implement queue management for bulk messaging
- Check your messaging tier limits in Meta Business Manager

### Getting Help

- **WhatsApp Cloud API Documentation**: [developers.facebook.com/docs/whatsapp/cloud-api](https://developers.facebook.com/docs/whatsapp/cloud-api)
- **Meta Business Help Center**: [business.facebook.com/help](https://business.facebook.com/help)
- **WhatsApp Business API Support**: Submit a ticket through Meta Business Suite

## Production Checklist

Before going to production:

- [ ] Business is verified with Meta
- [ ] Production phone number is registered and verified
- [ ] Permanent access token is configured
- [ ] Webhook is configured with HTTPS endpoint
- [ ] Message templates are created and approved
- [ ] Rate limiting is implemented
- [ ] Error handling is configured
- [ ] Logging and monitoring are set up
- [ ] Backup/failover strategy is in place
- [ ] Opt-in/opt-out mechanism is implemented
- [ ] Privacy policy is compliant with WhatsApp requirements
- [ ] Terms of service are clear about WhatsApp messaging

## Next Steps

- Review the [API Documentation](../README.md) for available endpoints
- Set up message templates for your use cases
- Implement opt-in mechanisms for compliance
- Set up monitoring and alerting
- Plan your bulk messaging strategy with queue management
