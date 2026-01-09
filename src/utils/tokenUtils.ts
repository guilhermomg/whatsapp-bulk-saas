import crypto from 'crypto';

/**
 * Generates a cryptographically secure random token
 * @param length - Length of the token in bytes (default: 32)
 * @returns Hex-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hashes a token using SHA256 for secure storage
 * Email verification and password reset tokens should be hashed before storing
 * @param token - Token to hash
 * @returns Hashed token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates an email verification token
 * @returns Plain token (send to user) and hashed token (store in database)
 */
export function generateEmailVerificationToken(): {
  token: string;
  hashedToken: string;
} {
  const token = generateSecureToken();
  const hashedToken = hashToken(token);
  return { token, hashedToken };
}

/**
 * Generates a password reset token
 * @returns Plain token (send to user) and hashed token (store in database)
 */
export function generatePasswordResetToken(): {
  token: string;
  hashedToken: string;
  expiresAt: Date;
} {
  const token = generateSecureToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return { token, hashedToken, expiresAt };
}

/**
 * Checks if a token has expired
 * @param expiresAt - Expiration date
 * @returns True if expired, false otherwise
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}
