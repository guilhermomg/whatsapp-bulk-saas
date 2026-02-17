import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import logger from '../config/logger';
import prisma from '../utils/prisma';

/**
 * Middleware to require email verification
 * Must be used after authenticate middleware
 */
export default async function requireVerifiedEmail(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    // Fetch user to check email verification status
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { emailVerified: true },
    });

    if (!user) {
      throw new ForbiddenError('User not found');
    }

    if (!user.emailVerified) {
      logger.warn('Unverified email access attempt', { userId: req.user.userId });
      throw new ForbiddenError(
        'Email verification required. Please verify your email address to access this resource.',
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
