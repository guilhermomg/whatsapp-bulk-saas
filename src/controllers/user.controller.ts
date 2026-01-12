import { Request, Response, NextFunction } from 'express';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/passwordUtils';
import { sanitizeUser } from '../utils/sanitizeUser';
import { changePasswordSchema, updateProfileSchema } from '../validators/authValidator';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '../utils/errors';
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

/**
 * Connect WhatsApp Business Account
 * POST /api/v1/users/connect-whatsapp
 */
export async function connectWhatsApp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { connectWhatsAppSchema } = await import('../validators/whatsapp.validator');
    const { encrypt } = await import('../utils/encryption');
    const axios = await import('axios');

    // Validate request body
    const { error, value } = connectWhatsAppSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { wabaId, phoneNumberId, accessToken } = value;

    // Validate credentials with WhatsApp API
    try {
      const whatsappApiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
      const response = await axios.default.get(
        `https://graph.facebook.com/${whatsappApiVersion}/${phoneNumberId}`,
        {
          params: {
            fields: 'display_phone_number,verified_name,quality_rating,messaging_limit_tier',
            access_token: accessToken,
          },
          timeout: 10000,
        },
      );

      const {
        display_phone_number: displayPhoneNumber,
        verified_name: verifiedName,
        quality_rating: qualityRating,
        messaging_limit_tier: messagingLimitTier,
      } = response.data;

      // Check if phone number is already connected to another user
      const existingUser = await prisma.user.findFirst({
        where: {
          phoneNumberId,
          id: { not: req.user.userId },
        },
      });

      if (existingUser) {
        throw new ConflictError(
          'This WhatsApp phone number is already connected to another account',
        );
      }

      // Encrypt access token before storing
      const encryptedToken = encrypt(accessToken);

      // Update user with WhatsApp credentials
      const user = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          wabaId,
          phoneNumberId,
          accessToken: encryptedToken,
          phoneNumber: displayPhoneNumber,
          whatsappConnectedAt: new Date(),
          whatsappQualityRating: qualityRating,
          whatsappMessagingLimit: messagingLimitTier,
        },
      });

      // Subscribe to webhooks (non-blocking, log errors but don't fail)
      try {
        await axios.default.post(
          `https://graph.facebook.com/${whatsappApiVersion}/${phoneNumberId}/subscribed_apps`,
          {},
          {
            params: { access_token: accessToken },
            timeout: 10000,
          },
        );
        logger.info('Webhook subscription successful', { userId: user.id, phoneNumberId });
      } catch (webhookError) {
        logger.warn('Webhook subscription failed (non-blocking)', {
          userId: user.id,
          phoneNumberId,
          error: webhookError instanceof Error ? webhookError.message : String(webhookError),
        });
      }

      logger.info('WhatsApp account connected successfully', {
        userId: user.id,
        phoneNumberId,
      });

      res.json({
        success: true,
        message: 'WhatsApp account connected successfully',
        data: {
          whatsapp: {
            phoneNumber: displayPhoneNumber,
            verifiedName,
            qualityRating,
            messagingLimitTier,
            connectedAt: user.whatsappConnectedAt,
          },
        },
      });
    } catch (apiError: unknown) {
      // Handle WhatsApp API errors
      if (axios.isAxiosError(apiError)) {
        const status = apiError.response?.status;
        const errorData = apiError.response?.data as {
          error?: { message?: string; code?: number };
        };

        if (status === 401 || status === 403) {
          throw new BadRequestError(
            'Invalid access token or insufficient permissions. Please check your WhatsApp Business Account credentials.',
          );
        }

        if (status === 404) {
          throw new BadRequestError(
            'Invalid phone number ID. Please verify your WhatsApp Business Account setup.',
          );
        }

        // For other WhatsApp API errors, throw as InternalServerError
        throw new Error(
          `Failed to validate WhatsApp credentials: ${errorData?.error?.message || 'Unknown error'}`,
        );
      }

      throw apiError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get WhatsApp connection status
 * GET /api/v1/users/me/whatsapp
 */
export async function getWhatsAppStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        phoneNumberId: true,
        phoneNumber: true,
        whatsappConnectedAt: true,
        whatsappQualityRating: true,
        whatsappMessagingLimit: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isConnected = !!(user.phoneNumberId && user.phoneNumber);

    res.json({
      success: true,
      data: {
        connected: isConnected,
        phoneNumber: user.phoneNumber || null,
        qualityRating: user.whatsappQualityRating || null,
        messagingLimitTier: user.whatsappMessagingLimit || null,
        connectedAt: user.whatsappConnectedAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Disconnect WhatsApp Business Account
 * DELETE /api/v1/users/me/whatsapp
 */
export async function disconnectWhatsApp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Clear WhatsApp credentials
    await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        wabaId: null,
        phoneNumberId: null,
        accessToken: null,
        phoneNumber: null,
        whatsappConnectedAt: null,
        whatsappQualityRating: null,
        whatsappMessagingLimit: null,
      },
    });

    logger.info('WhatsApp account disconnected', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'WhatsApp account disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
}
