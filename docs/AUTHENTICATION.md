# Authentication API Documentation

This guide provides examples of how to use the authentication endpoints in the WhatsApp Bulk SaaS API.

## Base URL

```
http://localhost:3000/api/v1
```

## Endpoints

### 1. Register New User

**Endpoint:** `POST /auth/register`

**Description:** Register a new user account with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!@#",
  "businessName": "My Business" // optional
}
```

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "businessName": "My Business",
      "emailVerified": false,
      "isActive": false,
      "subscriptionTier": "free",
      "createdAt": "2026-01-09T00:00:00.000Z",
      "updatedAt": "2026-01-09T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Rate Limit:** 5 requests per 15 minutes per IP

---

### 2. Login

**Endpoint:** `POST /auth/login`

**Description:** Login with email and password to receive a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!@#"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "businessName": "My Business",
      "emailVerified": true,
      "isActive": true,
      "lastLoginAt": "2026-01-09T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Brute Force Protection:**
- Account is locked for 30 minutes after 5 failed login attempts
- Login counter resets on successful login

**Rate Limit:** 10 requests per 15 minutes per IP

---

### 3. Get Current User

**Endpoint:** `GET /auth/me`

**Description:** Get the currently authenticated user's information.

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "businessName": "My Business",
      "emailVerified": true,
      "isActive": true,
      "wabaId": "whatsapp-business-account-id",
      "phoneNumberId": "phone-number-id"
    }
  }
}
```

---

### 4. Verify Email

**Endpoint:** `GET /auth/verify-email?token=<verification-token>`

**Description:** Verify email address using the token sent via email.

**Query Parameters:**
- `token` (required): Email verification token from the verification email

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully. Your account is now active."
}
```

**Note:** Verification tokens expire after 24 hours.

---

### 5. Resend Verification Email

**Endpoint:** `POST /auth/resend-verification`

**Description:** Request a new email verification link.

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification email sent. Please check your inbox."
}
```

**Rate Limit:** 3 requests per hour per user

---

### 6. Forgot Password

**Endpoint:** `POST /auth/forgot-password`

**Description:** Request a password reset link via email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Security Note:** The response is intentionally generic to prevent email enumeration attacks.

**Rate Limit:** 3 requests per hour per IP

---

### 7. Reset Password

**Endpoint:** `POST /auth/reset-password`

**Description:** Reset password using the token from the reset email.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123!@#"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successful. You can now log in with your new password."
}
```

**Note:** Reset tokens expire after 1 hour.

---

### 8. Get User Profile

**Endpoint:** `GET /users/me`

**Description:** Get the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Response:** Same as GET /auth/me

---

### 9. Update User Profile

**Endpoint:** `PUT /users/me`

**Description:** Update user profile information.

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Request Body:**
```json
{
  "businessName": "Updated Business Name",
  "wabaId": "your-waba-id",
  "phoneNumberId": "your-phone-number-id"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "businessName": "Updated Business Name",
      "wabaId": "your-waba-id",
      "phoneNumberId": "your-phone-number-id"
    }
  }
}
```

**Note:** This endpoint requires email verification.

---

### 10. Change Password

**Endpoint:** `PUT /users/me/password`

**Description:** Change the authenticated user's password.

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Request Body:**
```json
{
  "currentPassword": "CurrentPass123!@#",
  "newPassword": "NewSecurePass123!@#"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## Authentication Flow

### New User Registration Flow

1. **Register** (`POST /auth/register`)
   - User provides email, password, and optional business name
   - System creates account with `isActive: false` and `emailVerified: false`
   - System sends verification email
   - System returns JWT token (user can access some endpoints, but not all)

2. **Email Verification** (`GET /auth/verify-email?token=<token>`)
   - User clicks link in verification email
   - System verifies token and activates account
   - Sets `emailVerified: true` and `isActive: true`

3. **Access Protected Resources**
   - User can now access all endpoints that require `requireVerifiedEmail` middleware

### Login Flow

1. **Login** (`POST /auth/login`)
   - User provides email and password
   - System validates credentials
   - System checks for account lock (brute force protection)
   - System returns JWT token and user data
   - Updates `lastLoginAt` timestamp

2. **Use JWT Token**
   - Include token in Authorization header: `Authorization: Bearer <token>`
   - Token is valid for 7 days by default

### Password Reset Flow

1. **Request Reset** (`POST /auth/forgot-password`)
   - User provides email
   - System generates reset token (expires in 1 hour)
   - System sends reset email with link

2. **Reset Password** (`POST /auth/reset-password`)
   - User clicks link in email
   - User provides new password
   - System validates token and updates password
   - Clears reset token and unlocks account if locked

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Password must be at least 8 characters long"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Email verification required. Please verify your email address to access this resource."
}
```

### 409 Conflict
```json
{
  "success": false,
  "error": "An account with this email already exists"
}
```

### 423 Locked
```json
{
  "success": false,
  "error": "Account is locked due to too many failed login attempts. Please try again in 25 minutes."
}
```

---

## Security Features

1. **Password Hashing:** All passwords are hashed using bcrypt with cost factor 12
2. **JWT Tokens:** Secure token-based authentication with 7-day expiration
3. **Email Verification:** Required before accessing protected resources
4. **Brute Force Protection:** Account lock after 5 failed login attempts for 30 minutes
5. **Rate Limiting:** Aggressive rate limits on authentication endpoints
6. **Token Expiration:** Verification tokens expire in 24 hours, reset tokens in 1 hour
7. **Secure Token Generation:** Uses crypto.randomBytes for verification/reset tokens
8. **Token Hashing:** Verification and reset tokens are hashed before storage
9. **Email Enumeration Prevention:** Forgot password always returns success
10. **Data Sanitization:** Passwords and tokens never exposed in API responses

---

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "businessName": "Test Business"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Profile
```bash
curl -X PUT http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Updated Business"
  }'
```

### Change Password
```bash
curl -X PUT http://localhost:3000/api/v1/users/me/password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Test123!@#",
    "newPassword": "NewPass123!@#"
  }'
```

---

## Environment Variables

Required environment variables for authentication:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_FROM=noreply@whatsapp-bulk-saas.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_SECURE=false

# App URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000
```

---

## Next Steps

After registering and verifying your email, you can:

1. Connect your WhatsApp Business Account
2. Create message templates
3. Import contacts
4. Send bulk messages

See the main API documentation for details on these features.
