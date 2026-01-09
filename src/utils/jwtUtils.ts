import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config';

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Generates a JWT token for a user
 * @param userId - User ID
 * @param email - User email
 * @returns JWT token string
 */
export function generateToken(userId: string, email: string): string {
  const jwtSecret = config.auth.jwtSecret;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const options: SignOptions = {};
  const expiresIn = config.auth.jwtExpiresIn;
  if (expiresIn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (options as any).expiresIn = expiresIn;
  }

  return jwt.sign({ userId, email }, jwtSecret, options);
}

/**
 * Verifies a JWT token and returns the payload
 * @param token - JWT token string
 * @returns Decoded JWT payload
 * @throws Error if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  const jwtSecret = config.auth.jwtSecret;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Refreshes an expired token (generates a new token for the user)
 * @param token - Expired JWT token
 * @returns New JWT token
 * @throws Error if token is invalid or cannot be decoded
 */
export function refreshToken(token: string): string {
  const jwtSecret = config.auth.jwtSecret;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  try {
    // Decode without verifying to get the payload
    const decoded = jwt.decode(token) as JWTPayload;

    if (!decoded || !decoded.userId || !decoded.email) {
      throw new Error('Invalid token format');
    }

    // Generate a new token
    return generateToken(decoded.userId, decoded.email);
  } catch (error) {
    throw new Error('Unable to refresh token');
  }
}
