import { Request, Response } from 'express';
import logger from '../config/logger';
import getWhatsAppConfig from '../config/whatsapp';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import {
  verifyWebhookSignature,
  isWebhookProcessed,
  markWebhookAsProcessed,
} from '../utils/webhookUtils';
import {
  webhookVerificationSchema,
  webhookEventSchema,
} from '../validators/whatsapp.validator';

/**
 * @swagger
 * /webhooks/whatsapp:
 *   get:
 *     summary: WhatsApp webhook verification
 *     description: Handles webhook verification challenge from WhatsApp
 *     tags: [Webhooks]
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         required: true
 *         schema:
 *           type: string
 *         description: Should be 'subscribe'
 *       - in: query
 *         name: hub.verify_token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token configured in WhatsApp app
 *       - in: query
 *         name: hub.challenge
 *         required: true
 *         schema:
 *           type: string
 *         description: Challenge string to echo back
 *     responses:
 *       200:
 *         description: Verification successful
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       403:
 *         description: Invalid verification token
 */
export const verifyWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const whatsappConfig = getWhatsAppConfig();
    logger.info('Received webhook verification request', { query: req.query });
    // Validate query parameters
    const { error, value } = webhookVerificationSchema.validate(req.query);

    if (error) {
      throw new BadRequestError(`Invalid webhook verification: ${error.message}`);
    }

    const mode = value['hub.mode'];
    const token = value['hub.verify_token'];
    const challenge = value['hub.challenge'];

    // Verify token matches configured token
    if (mode === 'subscribe' && token === whatsappConfig.webhookVerifyToken) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('Webhook verification failed: Invalid token');
      throw new UnauthorizedError('Invalid verification token');
    }
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
      throw error;
    }
    logger.error('Webhook verification error', { error });
    throw new BadRequestError('Webhook verification failed');
  }
};

/**
 * @swagger
 * /webhooks/whatsapp:
 *   post:
 *     summary: WhatsApp webhook event handler
 *     description: Receives and processes webhook events from WhatsApp
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event received successfully
 *       400:
 *         description: Invalid webhook payload
 *       401:
 *         description: Invalid signature
 */
export const handleWebhookEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'] as string;
    // Use the raw body captured by captureRawBody middleware
    const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);

    if (!verifyWebhookSignature(signature, rawBody)) {
      logger.warn('Webhook signature verification failed', {
        signature: signature ? 'provided' : 'missing',
      });
      // Return 200 to avoid WhatsApp retrying, but log as error
      res.status(200).json({ success: false, error: 'Invalid signature' });
      return;
    }

    // Validate webhook payload
    const { error, value } = webhookEventSchema.validate(req.body);

    if (error) {
      logger.warn('Invalid webhook payload', { error: error.message });
      // Return 200 to avoid WhatsApp retrying
      res.status(200).json({ success: false, error: 'Invalid payload' });
      return;
    }

    // Process each entry in the webhook
    const { entry } = value;

    entry.forEach((entryItem: {
      id: string;
      changes: Array<{
        value: {
          metadata: { phone_number_id: string };
          messages?: Array<{ id: string; from: string; type: string; text?: { body: string } }>;
          statuses?: Array<{
            id: string;
            status: string;
            timestamp: string;
            recipient_id: string;
          }>;
        };
      }>;
    }) => {
      entryItem.changes.forEach((change) => {
        const { value: changeValue } = change;
        const messageIds = changeValue.messages && changeValue.messages.length > 0
          ? changeValue.messages.map((message) => message.id).join(',')
          : 'no-messages';
        const statusIds = changeValue.statuses && changeValue.statuses.length > 0
          ? changeValue.statuses.map((status) => status.id).join(',')
          : 'no-statuses';
        const webhookId = `${entryItem.id}-${changeValue.metadata.phone_number_id}-${messageIds}-${statusIds}`;

        // Check for duplicate webhook (idempotency)
        if (isWebhookProcessed(webhookId)) {
          logger.info('Duplicate webhook detected, skipping', { webhookId });
          return;
        }

        markWebhookAsProcessed(webhookId);

        // Handle message status updates
        if (changeValue.statuses && changeValue.statuses.length > 0) {
          changeValue.statuses.forEach((status) => {
            logger.info('Message status update received', {
              messageId: status.id,
              status: status.status,
              recipient: status.recipient_id,
              timestamp: status.timestamp,
            });

            // In production, update message status in database
            // Example: await updateMessageStatus(status.id, status.status);
          });
        }

        // Handle incoming messages
        if (changeValue.messages && changeValue.messages.length > 0) {
          changeValue.messages.forEach((message) => {
            logger.info('Incoming message received', {
              messageId: message.id,
              from: message.from,
              type: message.type,
              body: message.text?.body,
            });

            // In production, process incoming message (e.g., opt-out requests)
            // Example: await handleIncomingMessage(message);
          });
        }
      });
    });

    // WhatsApp requires a 200 response within 20 seconds
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook event handling error', { error });
    // Still return 200 to avoid retries from WhatsApp
    res.status(200).json({ success: false });
  }
};
