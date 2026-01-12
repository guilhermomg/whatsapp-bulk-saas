import express from 'express';
import * as userController from '../controllers/user.controller';
import authenticate from '../middleware/authenticate';
import requireVerifiedEmail from '../middleware/requireVerifiedEmail';
import { authenticatedLimiter, whatsappConnectionLimiter } from '../middleware/rateLimiters';

const router = express.Router();

// All user routes require authentication and rate limiting
router.use(authenticatedLimiter);
router.use(authenticate);

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Not authenticated
 */
router.get('/me', userController.getProfile);

/**
 * @swagger
 * /api/v1/users/me:
 *   put:
 *     summary: Update user profile
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessName:
 *                 type: string
 *                 maxLength: 100
 *               wabaId:
 *                 type: string
 *               phoneNumberId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Email verification required
 */
router.put('/me', requireVerifiedEmail, userController.updateProfile);

/**
 * @swagger
 * /api/v1/users/me/password:
 *   put:
 *     summary: Change password
 *     tags: [User Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated or incorrect password
 */
router.put('/me/password', userController.changePassword);

/**
 * @swagger
 * /api/v1/users/connect-whatsapp:
 *   post:
 *     summary: Connect WhatsApp Business Account
 *     description: Validates and stores WhatsApp Business Account credentials
 *     tags: [WhatsApp Connection]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wabaId
 *               - phoneNumberId
 *               - accessToken
 *             properties:
 *               wabaId:
 *                 type: string
 *                 description: WhatsApp Business Account ID
 *                 example: "123456789"
 *               phoneNumberId:
 *                 type: string
 *                 description: Phone Number ID from WhatsApp Business
 *                 example: "987654321"
 *               accessToken:
 *                 type: string
 *                 description: Permanent access token from Meta Business
 *                 example: "EAATaDzTD97ABQb..."
 *     responses:
 *       200:
 *         description: WhatsApp account connected successfully
 *       400:
 *         description: Validation error or invalid credentials
 *       401:
 *         description: Not authenticated
 *       409:
 *         description: Phone number already connected to another account
 *       502:
 *         description: WhatsApp API error
 */
router.post(
  '/connect-whatsapp',
  whatsappConnectionLimiter,
  requireVerifiedEmail,
  userController.connectWhatsApp,
);

/**
 * @swagger
 * /api/v1/users/me/whatsapp:
 *   get:
 *     summary: Get WhatsApp connection status
 *     description: Returns connection status and account information
 *     tags: [WhatsApp Connection]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WhatsApp connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     phoneNumber:
 *                       type: string
 *                     qualityRating:
 *                       type: string
 *                     messagingLimitTier:
 *                       type: string
 *                     connectedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Not authenticated
 */
router.get('/me/whatsapp', userController.getWhatsAppStatus);

/**
 * @swagger
 * /api/v1/users/me/whatsapp:
 *   delete:
 *     summary: Disconnect WhatsApp Business Account
 *     description: Removes WhatsApp credentials from the account
 *     tags: [WhatsApp Connection]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WhatsApp account disconnected successfully
 *       401:
 *         description: Not authenticated
 */
router.delete('/me/whatsapp', userController.disconnectWhatsApp);

export default router;
