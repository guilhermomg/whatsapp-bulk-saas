import { Request, Response, NextFunction } from 'express';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import prisma from '../utils/prisma';

/**
 * Middleware to require WhatsApp Business Account connection
 * Verifies that the authenticated user has connected their WhatsApp account
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

    // Fetch user to check WhatsApp connection
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        phoneNumberId: true,
        accessToken: true,
      },
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

    next();
  } catch (error) {
    next(error);
  }
}
