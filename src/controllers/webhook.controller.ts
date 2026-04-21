import { Request, Response } from 'express';
import { Prisma, MessageStatus } from '@prisma/client';
import logger from '../config/logger';
import getWhatsAppConfig from '../config/whatsapp';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { verifyWebhookSignature } from '../utils/webhookUtils';
import {
  webhookVerificationSchema,
  webhookEventSchema,
} from '../validators/whatsapp.validator';
import { WhatsAppTemplateService } from '../services/whatsAppTemplateService';
import messageRepo from '../repositories/messageRepository';
import campaignRepo from '../repositories/campaignRepository';
import webhookEventRepo from '../repositories/webhookEventRepository';

type WhatsAppStatus = 'sent' | 'delivered' | 'read' | 'failed';

type WebhookStatus = {
  id: string;
  status: WhatsAppStatus;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
};

type WebhookChangeValue = {
  event?: string;
  message_template_id?: string;
  message_template_name?: string;
  status?: string;
  rejection_reason?: string;
  messaging_product?: string;
  metadata?: { phone_number_id: string; display_phone_number?: string };
  messages?: Array<{ id: string; from: string; type: string; text?: { body: string } }>;
  statuses?: WebhookStatus[];
};

type WebhookEntry = {
  id: string;
  changes: Array<{ field: string; value: WebhookChangeValue }>;
};

const WHATSAPP_STATUS_MAP: Record<string, MessageStatus | undefined> = {
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
};

const mapWhatsAppStatus = (status: string): MessageStatus | null => (
  WHATSAPP_STATUS_MAP[status] ?? null
);

const processStatusUpdate = async (status: WebhookStatus): Promise<void> => {
  const mappedStatus = mapWhatsAppStatus(status.status);

  if (!mappedStatus) {
    logger.warn('Unknown WhatsApp message status, skipping', { status: status.status });
    return;
  }

  logger.info('Message status update received', {
    messageId: status.id,
    status: status.status,
    recipient: status.recipient_id,
    timestamp: status.timestamp,
  });

  const errorCode = status.errors?.[0]?.code?.toString();
  const errorMessage = status.errors?.[0]?.title;

  const message = await messageRepo.updateStatusByWhatsAppMessageId(
    status.id,
    mappedStatus,
    errorCode,
    errorMessage,
  );

  if (!message) {
    logger.warn('Message not found for WhatsApp message ID', { whatsappMessageId: status.id });
    return;
  }

  if (message.campaignId) {
    if (mappedStatus === 'delivered') {
      await campaignRepo.incrementDeliveredCount(message.campaignId);
    } else if (mappedStatus === 'read') {
      await campaignRepo.incrementReadCount(message.campaignId);
    } else if (mappedStatus === 'failed') {
      await campaignRepo.incrementFailedCount(message.campaignId);
    }
  }
};

const processWebhookChange = async (
  entryId: string,
  changeValue: WebhookChangeValue,
  whatsAppTemplateService: WhatsAppTemplateService,
): Promise<void> => {
  if (changeValue.event === 'message_template_status_update') {
    const templateStatus = changeValue.status || 'PENDING';
    logger.info('Template status update received', {
      templateId: changeValue.message_template_id,
      templateName: changeValue.message_template_name,
      status: templateStatus,
      rejectionReason: changeValue.rejection_reason,
    });

    try {
      await whatsAppTemplateService.handleTemplateStatusUpdate({
        whatsappTemplateId: changeValue.message_template_id || '',
        status: templateStatus as Parameters<
          typeof whatsAppTemplateService.handleTemplateStatusUpdate
        >[0]['status'],
        rejectionReason: changeValue.rejection_reason || undefined,
      });
    } catch (templateError) {
      logger.error('Error processing template status update:', templateError);
    }

    return;
  }

  const phoneNumberId = changeValue.metadata?.phone_number_id || 'unknown';
  const messageIds = changeValue.messages?.map((m) => m.id).join(',') || 'no-messages';
  const statusIds = changeValue.statuses?.map((s) => s.id).join(',') || 'no-statuses';
  const webhookId = `${entryId}-${phoneNumberId}-${messageIds}-${statusIds}`;

  const existing = await webhookEventRepo.findByExternalId(webhookId);
  if (existing) {
    logger.info('Duplicate webhook detected, skipping', { webhookId });
    return;
  }

  const webhookEvent = await webhookEventRepo.create({
    externalId: webhookId,
    eventType: 'message_status',
    payload: changeValue as unknown as Prisma.InputJsonValue,
    processed: false,
    receivedAt: new Date(),
  });

  try {
    await Promise.all((changeValue.statuses ?? []).map(processStatusUpdate));

    if (changeValue.messages) {
      changeValue.messages.forEach((msg) => {
        logger.info('Incoming message received', {
          messageId: msg.id,
          from: msg.from,
          type: msg.type,
          body: msg.text?.body,
        });
      });
    }

    await webhookEventRepo.markAsProcessed(webhookEvent.id);
  } catch (processError) {
    const errMsg = processError instanceof Error ? processError.message : 'Unknown error';
    logger.error('Error processing webhook change', { webhookId, error: processError });
    await webhookEventRepo.markAsFailed(webhookEvent.id, errMsg);
  }
};

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
    const { error, value } = webhookVerificationSchema.validate(req.query);

    if (error) {
      throw new BadRequestError(`Invalid webhook verification: ${error.message}`);
    }

    const mode = value['hub.mode'];
    const token = value['hub.verify_token'];
    const challenge = value['hub.challenge'];

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
    const whatsAppTemplateService = new WhatsAppTemplateService();

    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);

    if (!verifyWebhookSignature(signature, rawBody)) {
      logger.warn('Webhook signature verification failed', {
        signature: signature ? 'provided' : 'missing',
      });
      res.status(200).json({ success: false, error: 'Invalid signature' });
      return;
    }

    const { error, value } = webhookEventSchema.validate(req.body);

    if (error) {
      logger.warn('Invalid webhook payload', { error: error.message });
      res.status(200).json({ success: false, error: 'Invalid payload' });
      return;
    }

    const { entry } = value as { entry: WebhookEntry[] };

    await Promise.all(
      entry.map((entryItem) => Promise.all(
        entryItem.changes.map((change) => processWebhookChange(
          entryItem.id,
          change.value,
          whatsAppTemplateService,
        )),
      )),
    );

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook event handling error', { error });
    res.status(200).json({ success: false });
  }
};
