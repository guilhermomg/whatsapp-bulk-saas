import { Request, Response, NextFunction } from 'express';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/passwordUtils';
import { sanitizeUser } from '../utils/sanitizeUser';
import { changePasswordSchema, updateProfileSchema } from '../validators/authValidator';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';
import logger from '../config/logger';
import prisma from '../../prisma.config';

/**
 * Get user profile
 * GET /api/v1/users/me
 */
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const safeUser = sanitizeUser(user);

    res.json({
      success: true,
      data: { user: safeUser },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user profile
 * PUT /api/v1/users/me
 */
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { businessName, wabaId, phoneNumberId } = value;

    // Build update data object
    const updateData: {
      businessName?: string | null;
      wabaId?: string | null;
      phoneNumberId?: string | null;
    } = {};

    if (businessName !== undefined) updateData.businessName = businessName;
    if (wabaId !== undefined) updateData.wabaId = wabaId;
    if (phoneNumberId !== undefined) updateData.phoneNumberId = phoneNumberId;

    // Update user
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
    });

    const safeUser = sanitizeUser(user);

    logger.info('User profile updated', { userId: user.id });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: safeUser },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change password
 * PUT /api/v1/users/me/password
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Validate request body
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { currentPassword, newPassword } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new BadRequestError(passwordValidation.error || 'Invalid password');
    }

    // Check if new password is different from current
    const isSamePassword = await comparePassword(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestError('New password must be different from current password');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    logger.info('Password changed successfully', { userId: user.id });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}
