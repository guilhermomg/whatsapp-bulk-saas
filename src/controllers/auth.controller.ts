import { Request, Response, NextFunction } from 'express';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/passwordUtils';
import { generateToken } from '../utils/jwtUtils';
import {
  generateEmailVerificationToken,
  generatePasswordResetToken,
  hashToken,
  isTokenExpired,
} from '../utils/tokenUtils';
import { sanitizeUser } from '../utils/sanitizeUser';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendAccountLockedEmail,
} from '../services/emailService';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/authValidator';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '../utils/errors';
import logger from '../config/logger';
import { encrypt } from '../utils/encryption';
import prisma from '../prisma.config';

const ACCOUNT_LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { email, password, businessName } = value;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestError(passwordValidation.error || 'Invalid password');
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate email verification token
    const {
      token: verificationToken,
      hashedToken: hashedVerificationToken,
    } = generateEmailVerificationToken();

    // Create placeholder encrypted access token until user connects WhatsApp
    // Using a randomly generated token for security
    const placeholderToken = `placeholder_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const defaultAccessToken = encrypt(placeholderToken);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        businessName: businessName || null,
        emailVerificationToken: hashedVerificationToken,
        isActive: false, // Will be activated after email verification
        emailVerified: false,
        accessToken: defaultAccessToken,
      },
    });

    // Send verification email (don't wait for it to complete)
    sendVerificationEmail(user.email, verificationToken, businessName || user.email).catch(
      (err) => {
        logger.error('Failed to send verification email during registration', {
          error: err,
          userId: user.id,
        });
      },
    );

    // Generate JWT token for immediate login (but require verification for protected routes)
    const jwtToken = generateToken(user.id, user.email);

    // Sanitize user data
    const safeUser = sanitizeUser(user);

    logger.info('User registered successfully', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: safeUser,
        token: jwtToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user
 * POST /api/v1/auth/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { email, password } = value;

    // Find user (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockUntil && new Date() < user.lockUntil) {
      const remainingMinutes = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / 1000 / 60,
      );
      logger.warn('Login attempt on locked account', { userId: user.id });
      throw new UnauthorizedError(
        `Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minutes.`,
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      // Increment login attempts
      const newLoginAttempts = user.loginAttempts + 1;
      const updateData: {
        loginAttempts: number;
        lockUntil?: Date;
      } = {
        loginAttempts: newLoginAttempts,
      };

      // Lock account if max attempts reached
      if (newLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
        updateData.lockUntil = lockUntil;

        // Send account locked email (don't wait for it)
        sendAccountLockedEmail(user.email, user.businessName || user.email, 30).catch((err) => {
          logger.error('Failed to send account locked email', {
            error: err,
            userId: user.id,
          });
        });

        logger.warn('Account locked due to failed login attempts', {
          userId: user.id,
          attempts: newLoginAttempts,
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedError('Invalid email or password');
    }

    // Successful login - reset login attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate JWT token
    const jwtToken = generateToken(user.id, user.email);

    // Sanitize user data
    const safeUser = sanitizeUser(user);

    logger.info('User logged in successfully', { userId: user.id });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: safeUser,
        token: jwtToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify email with token
 * GET /api/v1/auth/verify-email?token=<token>
 */
export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Validate query parameters
    const { error, value } = verifyEmailSchema.validate(req.query);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { token } = value;

    // Hash the token to compare with stored hash
    const hashedToken = hashToken(token);

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
      },
    });

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    if (user.emailVerified) {
      throw new BadRequestError('Email is already verified');
    }

    // Verify token hasn't expired (24 hours from user creation)
    const tokenAge = Date.now() - user.createdAt.getTime();
    const maxAge = EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000;

    if (tokenAge > maxAge) {
      throw new BadRequestError('Verification token has expired. Please request a new one.');
    }

    // Mark email as verified and activate account
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        isActive: true,
      },
    });

    logger.info('Email verified successfully', { userId: user.id });

    res.json({
      success: true,
      message: 'Email verified successfully. Your account is now active.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resend verification email
 * POST /api/v1/auth/resend-verification
 */
export async function resendVerification(
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
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestError('Email is already verified');
    }

    // Generate new verification token
    const {
      token: verificationToken,
      hashedToken: hashedVerificationToken,
    } = generateEmailVerificationToken();

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedVerificationToken,
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken, user.businessName || user.email);

    logger.info('Verification email resent', { userId: user.id });

    res.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Validate request body
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { email } = value;

    // Find user (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    const successMessage = 'If an account with that email exists, a password reset link has been sent.';

    if (!user) {
      // Still send success response to prevent email enumeration
      logger.info('Password reset requested for non-existent email', { email });
      res.json({
        success: true,
        message: successMessage,
      });
      return;
    }

    // Generate password reset token
    const {
      token: resetToken,
      hashedToken: hashedResetToken,
      expiresAt,
    } = generatePasswordResetToken();

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedResetToken,
        passwordResetExpires: expiresAt,
      },
    });

    // Send password reset email (don't wait for it)
    sendPasswordResetEmail(user.email, resetToken, user.businessName || user.email).catch(
      (err) => {
        logger.error('Failed to send password reset email', {
          error: err,
          userId: user.id,
        });
      },
    );

    logger.info('Password reset requested', { userId: user.id });

    res.json({
      success: true,
      message: successMessage,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Validate request body
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { token, password } = value;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new BadRequestError(passwordValidation.error || 'Invalid password');
    }

    // Hash the token to compare with stored hash
    const hashedToken = hashToken(token);

    // Find user with this reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
      },
    });

    if (!user || !user.passwordResetExpires) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Check if token has expired
    if (isTokenExpired(user.passwordResetExpires)) {
      throw new BadRequestError('Reset token has expired. Please request a new one.');
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        loginAttempts: 0, // Reset login attempts
        lockUntil: null, // Unlock account if it was locked
      },
    });

    logger.info('Password reset successfully', { userId: user.id });

    res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current authenticated user
 * GET /api/v1/auth/me
 */
export async function getCurrentUser(
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
