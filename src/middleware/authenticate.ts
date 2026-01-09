import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwtUtils';
import { UnauthorizedError } from '../utils/errors';
import logger from '../config/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header and attaches user to request
 */
export default function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No authorization token provided');
    }

    // Check if token follows "Bearer <token>" format
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid authorization format. Use Bearer <token>');
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify and decode token
    const decoded = verifyToken(token);

    // Attach user info to request
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }

    // Handle JWT-specific errors
    const errorMessage = error instanceof Error ? error.message : 'Invalid token';

    if (errorMessage.includes('expired')) {
      logger.warn('Token expired', { userId: req.user?.userId });
      next(new UnauthorizedError('Token has expired. Please log in again.'));
      return;
    }

    if (errorMessage.includes('invalid')) {
      logger.warn('Invalid token attempt');
      next(new UnauthorizedError('Invalid token'));
      return;
    }

    logger.error('Authentication error', { error });
    next(new UnauthorizedError('Authentication failed'));
  }
}
