import { Request, Response } from 'express';
import logger from '../config/logger';
import WhatsAppClient from '../services/whatsapp/whatsappClient';
import { sendTextMessageSchema, sendTemplateMessageSchema } from '../validators/whatsapp.validator';
import { ValidationError, UnauthorizedError } from '../utils/errors';
import prisma from '../../prisma.config';

/**
 * Get WhatsApp client for the authenticated user
 */
const getWhatsAppClientForUser = async (userId: string): Promise<WhatsAppClient> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  if (!user.phoneNumberId || !user.accessToken) {
    throw new ValidationError(
      'WhatsApp account not configured. Please connect your WhatsApp Business Account first.',
    );
  }

  return new WhatsAppClient(user);
};

/**
 * @swagger
 * /messages/send:
 *   post:
 *     summary: Send a WhatsApp message
 *     description: Send a text or template message via WhatsApp Cloud API
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [text]
 *                   to:
 *                     type: string
 *                     example: "+14155238886"
 *                   body:
 *                     type: string
 *                     example: "Hello from WhatsApp!"
 *                   previewUrl:
 *                     type: boolean
 *                     example: false
 *               - type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [template]
 *                   to:
 *                     type: string
 *                     example: "+14155238886"
 *                   templateName:
 *                     type: string
 *                     example: "hello_world"
 *                   languageCode:
 *                     type: string
 *                     example: "en_US"
 *                   components:
 *                     type: array
 *                     items:
 *                       type: object
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Message sent successfully"
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication failed
 *       429:
 *         description: Rate limit exceeded
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  const { type } = req.body;

  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  if (typeof type !== 'string') {
    throw new ValidationError('Invalid message type. Must be "text" or "template"');
  }

  // Get WhatsApp client for the authenticated user
  const whatsappClient = await getWhatsAppClientForUser(req.user.userId);

  if (type === 'text') {
    // Validate text message payload
    const { error, value } = sendTextMessageSchema.validate(req.body);

    if (error) {
      throw new ValidationError(`Invalid text message: ${error.message}`);
    }

    logger.info('Sending text message', {
      userId: req.user.userId,
      to: value.to.slice(-4), // Only log last 4 digits for privacy
    });

    const result = await whatsappClient.sendTextMessage({
      to: value.to,
      body: value.body,
      previewUrl: value.previewUrl,
    });

    res.status(200).json({
      success: true,
      message: 'Text message sent successfully',
      data: {
        messageId: result.messages[0].id,
        waId: result.contacts[0].wa_id,
      },
    });
  } else if (type === 'template') {
    // Validate template message payload
    const { error, value } = sendTemplateMessageSchema.validate(req.body);

    if (error) {
      throw new ValidationError(`Invalid template message: ${error.message}`);
    }

    logger.info('Sending template message', {
      userId: req.user.userId,
      to: value.to.slice(-4), // Only log last 4 digits for privacy
      template: value.templateName,
    });

    const result = await whatsappClient.sendTemplateMessage({
      to: value.to,
      templateName: value.templateName,
      languageCode: value.languageCode,
      components: value.components,
    });

    res.status(200).json({
      success: true,
      message: 'Template message sent successfully',
      data: {
        messageId: result.messages[0].id,
        waId: result.contacts[0].wa_id,
      },
    });
  } else {
    throw new ValidationError('Invalid message type. Must be "text" or "template"');
  }
};

/**
 * @swagger
 * /whatsapp/status:
 *   get:
 *     summary: WhatsApp service health check
 *     description: Verify WhatsApp API connectivity and credentials for authenticated user
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "WhatsApp service is operational"
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     phoneNumber:
 *                       type: object
 *       401:
 *         description: Not authenticated
 *       503:
 *         description: Service is unavailable
 */
export const getWhatsAppStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const whatsappClient = await getWhatsAppClientForUser(req.user.userId);
    const isConnected = await whatsappClient.checkConnectivity();

    if (!isConnected) {
      res.status(503).json({
        success: false,
        message: 'WhatsApp service is not available',
        data: {
          connected: false,
        },
      });
      return;
    }

    const phoneNumberInfo = await whatsappClient.getPhoneNumberInfo();

    res.status(200).json({
      success: true,
      message: 'WhatsApp service is operational',
      data: {
        connected: true,
        phoneNumber: {
          displayName: phoneNumberInfo.display_phone_number,
          verifiedName: phoneNumberInfo.verified_name,
          qualityRating: phoneNumberInfo.quality_rating,
        },
      },
    });
  } catch (error) {
    logger.error('WhatsApp status check failed', { error });
    res.status(503).json({
      success: false,
      message: 'WhatsApp service check failed',
      data: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};
