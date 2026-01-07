# API Error Response Documentation

This document describes the error response formats for the WhatsApp Bulk SaaS API.

## Standard Error Response Format

All error responses follow this standard format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "requestId": "uuid-v4-request-id"
}
```

In development mode (`NODE_ENV=development`), errors also include a stack trace:

```json
{
  "success": false,
  "error": "Error message",
  "requestId": "uuid-v4-request-id",
  "stack": "Error stack trace..."
}
```

## HTTP Status Codes

The API uses standard HTTP status codes to indicate the success or failure of requests:

| Status Code | Meaning | Description |
|-------------|---------|-------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Authentication failed (invalid or expired token) |
| 403 | Forbidden | Authenticated but not authorized for this resource |
| 404 | Not Found | Requested resource doesn't exist |
| 409 | Conflict | Request conflicts with current state of the server |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server encountered an unexpected error |
| 503 | Service Unavailable | Service temporarily unavailable (e.g., WhatsApp API down) |

## Common Error Responses

### 400 Bad Request

Invalid request format or missing required fields.

```json
{
  "success": false,
  "error": "Invalid request body",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 401 Unauthorized (WhatsApp Authentication)

WhatsApp API authentication failed. Check your access token.

```json
{
  "success": false,
  "error": "WhatsApp authentication failed: Invalid access token",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 404 Not Found

Endpoint or resource doesn't exist.

```json
{
  "success": false,
  "error": "Not Found - /api/v1/nonexistent",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 422 Validation Error

Request validation failed. The error message provides details.

**Invalid Phone Number:**
```json
{
  "success": false,
  "error": "Invalid text message: Phone number must be in E.164 format (e.g., +14155238886)",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Missing Required Field:**
```json
{
  "success": false,
  "error": "Invalid text message: Message body is required",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Invalid Language Code:**
```json
{
  "success": false,
  "error": "Invalid template message: Language code must be in format like en_US, pt_BR, etc.",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 429 Rate Limit Exceeded

WhatsApp rate limit exceeded (80 requests/second per phone number).

```json
{
  "success": false,
  "error": "WhatsApp rate limit exceeded: Too many requests",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 503 Service Unavailable

WhatsApp service is unavailable or connectivity check failed.

```json
{
  "success": false,
  "message": "WhatsApp service is not available",
  "data": {
    "connected": false
  }
}
```

## WhatsApp-Specific Errors

### Template Error

Template message failed - template may not exist or not be approved.

```json
{
  "success": false,
  "error": "WhatsApp template error: Template 'order_confirmation' not found or not approved",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Invalid Recipient

Recipient phone number is invalid or cannot receive messages.

```json
{
  "success": false,
  "error": "Invalid recipient phone number: +1234567890 is not a valid WhatsApp number",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

## Validation Rules

### Phone Numbers

- Must be in E.164 format
- Pattern: `^\+?[1-9]\d{1,14}$`
- Examples:
  - Valid: `+14155238886`, `+5511987654321`
  - Invalid: `4155238886`, `+1-415-523-8886`, `415-523-8886`

### Message Body

- Minimum: 1 character
- Maximum: 4096 characters
- Cannot be empty or only whitespace

### Language Code

- Must be in format: `xx_YY`
- Pattern: `^[a-z]{2}_[A-Z]{2}$`
- Examples:
  - Valid: `en_US`, `pt_BR`, `es_ES`, `fr_FR`
  - Invalid: `en`, `EN_US`, `en-US`, `english`

### Template Name

- Required for template messages
- Must be pre-approved in Meta Business Manager
- Case-sensitive

## Webhook Errors

Webhook errors are handled specially - they always return HTTP 200 to prevent WhatsApp from retrying.

### Invalid Signature

```json
{
  "success": false,
  "error": "Invalid signature"
}
```

### Invalid Payload

```json
{
  "success": false,
  "error": "Invalid payload"
}
```

## Error Handling Best Practices

### Client-Side Handling

1. **Check `success` field**: Always check if `success` is `true` or `false`
2. **Handle specific status codes**: Implement different handling for different error types
3. **Display user-friendly messages**: Don't show raw error messages to end users
4. **Retry logic**: Implement exponential backoff for 429 and 503 errors
5. **Log requestId**: Include the `requestId` when reporting errors for debugging

### Example Error Handling (JavaScript)

```javascript
async function sendWhatsAppMessage(data) {
  try {
    const response = await fetch('http://localhost:3000/api/v1/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      // Handle error based on status code
      switch (response.status) {
        case 401:
          console.error('Authentication failed. Check your WhatsApp credentials.');
          break;
        case 422:
          console.error('Validation error:', result.error);
          break;
        case 429:
          console.error('Rate limit exceeded. Please slow down.');
          // Implement exponential backoff
          break;
        case 503:
          console.error('WhatsApp service unavailable. Try again later.');
          break;
        default:
          console.error('Error:', result.error);
      }
      
      // Log request ID for debugging
      console.log('Request ID:', result.requestId);
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error('Network error:', error.message);
    return null;
  }
}
```

## Getting Help

If you encounter persistent errors:

1. Check the [WhatsApp Setup Guide](WHATSAPP_SETUP.md)
2. Verify your credentials in the `.env` file
3. Check application logs in the `logs/` directory
4. Review the [WhatsApp Cloud API Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
5. Submit an issue on GitHub with:
   - Error message and status code
   - Request ID
   - Steps to reproduce
   - Relevant log excerpts (with sensitive data redacted)
