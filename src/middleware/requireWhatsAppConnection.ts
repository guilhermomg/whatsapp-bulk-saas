import { Request, Response, NextFunction } from 'express';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import prisma from '../../prisma.config';

/**
 * Middleware to require WhatsApp Business Account connection
 * Verifies that the authenticated user has connected their WhatsApp account
 * and attaches the full user object with credentials to req.user
 */
export default async function requireWhatsAppConnection(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Fetch full user with WhatsApp credentials
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check if user has connected WhatsApp account
    if (!user.phoneNumberId || !user.accessToken) {
      throw new BadRequestError(
        'WhatsApp account not configured. Please connect your WhatsApp Business Account first.',
      );
    }

    // Attach full user object with credentials to request
    // This allows downstream handlers to access WhatsApp credentials
    req.user = {
      ...req.user,
      // @ts-ignore - Extending the user object with full user data
      fullUser: user,
    };

    next();
  } catch (error) {
    next(error);
  }
}
