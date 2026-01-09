import express from 'express';
import * as userController from '../controllers/user.controller';
import authenticate from '../middleware/authenticate';
import requireVerifiedEmail from '../middleware/requireVerifiedEmail';

const router = express.Router();

// All user routes require authentication
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

export default router;
