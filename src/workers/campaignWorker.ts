import { Worker, Job } from 'bullmq';
import redisConnection from '../config/redis';
import campaignQueue, { CampaignJobData } from '../queues/campaignQueue';
import WhatsAppClient from '../services/whatsapp/whatsappClient';
import { CampaignRepository } from '../repositories/campaignRepository';
import { ContactRepository } from '../repositories/contactRepository';
import { MessageRepository } from '../repositories/messageRepository';
import { TemplateRepository } from '../repositories/templateRepository';
import { WhatsAppRateLimitError } from '../utils/errors';
import prisma from '../utils/prisma';
import logger from '../config/logger';

const campaignRepo = new CampaignRepository();
const contactRepo = new ContactRepository();
const messageRepo = new MessageRepository();
const templateRepo = new TemplateRepository();

const RATE_LIMIT_PAUSE_MS = 30_000;

async function processJob(job: Job<CampaignJobData>): Promise<void> {
  const {
    campaignId, userId, contactId, templateId,
  } = job.data;

  const campaign = await campaignRepo.findById(campaignId);
  if (!campaign || campaign.status === 'paused' || campaign.status === 'failed') {
    logger.info('Skipping job for inactive campaign', { campaignId, status: campaign?.status });
    return;
  }

  // Use prisma directly to get encrypted accessToken (WhatsAppClient decrypts it)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    logger.warn('User not found for campaign job', { userId, campaignId });
    await campaignRepo.incrementFailedCount(campaignId);
    return;
  }

  const contact = await contactRepo.findById(contactId);
  if (!contact || !contact.optedIn || contact.isBlocked) {
    logger.info('Skipping opted-out or blocked contact', { contactId, campaignId });
    await campaignRepo.incrementFailedCount(campaignId);
    return;
  }

  const template = await templateRepo.findById(templateId);
  if (!template) {
    logger.warn('Template not found for campaign job', { templateId, campaignId });
    await campaignRepo.incrementFailedCount(campaignId);
    return;
  }

  const whatsapp = new WhatsAppClient(user);

  try {
    const response = await whatsapp.sendTemplateMessage({
      to: contact.phone,
      templateName: template.name,
      languageCode: template.language,
    });

    const whatsappMessageId = response.messages[0]?.id;

    await messageRepo.create({
      campaign: { connect: { id: campaignId } },
      contact: { connect: { id: contactId } },
      user: { connect: { id: userId } },
      whatsappMessageId,
      direction: 'outbound',
      type: 'template',
      content: { templateId, templateName: template.name },
      status: 'sent',
      sentAt: new Date(),
    });

    await campaignRepo.incrementSentCount(campaignId);
  } catch (error) {
    if (error instanceof WhatsAppRateLimitError) {
      logger.warn('WhatsApp rate limit hit, pausing queue for 30s', { campaignId });
      await campaignQueue.pause();
      setTimeout(async () => {
        await campaignQueue.resume();
        logger.info('Campaign queue resumed after rate limit cooldown');
      }, RATE_LIMIT_PAUSE_MS);
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send campaign message', { campaignId, contactId, errorMessage });

    await messageRepo.create({
      campaign: { connect: { id: campaignId } },
      contact: { connect: { id: contactId } },
      user: { connect: { id: userId } },
      direction: 'outbound',
      type: 'template',
      content: { templateId, templateName: template.name },
      status: 'failed',
      failedAt: new Date(),
      errorMessage,
    });

    await campaignRepo.incrementFailedCount(campaignId);
  }

  const stats = await campaignRepo.getCampaignStats(campaignId);
  if (stats && stats.sentCount + stats.failedCount >= stats.totalRecipients) {
    await campaignRepo.updateStatus(campaignId, 'completed');
    logger.info('Campaign completed', {
      campaignId,
      sentCount: stats.sentCount,
      failedCount: stats.failedCount,
    });
  }
}

const worker = new Worker<CampaignJobData>(
  'campaign-messages',
  processJob,
  {
    connection: redisConnection,
    limiter: {
      max: 1,
      duration: 4000,
    },
    concurrency: 1,
  },
);

worker.on('failed', (job, err) => {
  logger.error('Campaign job failed permanently', {
    jobId: job?.id,
    campaignId: job?.data.campaignId,
    error: err.message,
  });
});

export default worker;
