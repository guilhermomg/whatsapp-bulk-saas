import { Campaign, CampaignStatus, Contact, Prisma } from '@prisma/client';
import { CampaignRepository } from '../repositories/campaignRepository';
import { ContactRepository } from '../repositories/contactRepository';
import { MessageRepository } from '../repositories/messageRepository';
import { TemplateRepository } from '../repositories/templateRepository';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../utils/errors';
import { SENDABLE_TEMPLATE_STATUSES } from './templateService';
import WhatsAppClient from './whatsapp/whatsappClient';
import campaignQueue from '../queues/campaignQueue';
import prisma from '../utils/prisma';
import logger from '../config/logger';

export interface ContactFilter {
  tags?: string[];
}

export interface CreateCampaignData {
  name: string;
  templateId: string;
  contactFilter?: ContactFilter;
  contactIds?: string[];
  scheduledAt?: Date;
}

export interface UpdateCampaignData {
  name?: string;
  templateId?: string;
  contactFilter?: ContactFilter;
  contactIds?: string[];
  scheduledAt?: Date;
}

export interface ListCampaignsParams {
  userId: string;
  limit?: number;
  offset?: number;
  status?: CampaignStatus;
}

const BATCH_SIZE = 50;
const BATCH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export class CampaignService {
  private campaignRepo: CampaignRepository;

  private contactRepo: ContactRepository;

  private templateRepo: TemplateRepository;

  private messageRepo: MessageRepository;

  constructor(
    campaignRepo = new CampaignRepository(),
    contactRepo = new ContactRepository(),
    templateRepo = new TemplateRepository(),
    messageRepo = new MessageRepository(),
  ) {
    this.campaignRepo = campaignRepo;
    this.contactRepo = contactRepo;
    this.templateRepo = templateRepo;
    this.messageRepo = messageRepo;
  }

  private async runSynchronously(
    campaignId: string,
    userId: string,
    contacts: Contact[],
    templateId: string,
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await this.campaignRepo.updateStatus(campaignId, 'failed', 'User not found');
      return;
    }

    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      await this.campaignRepo.updateStatus(campaignId, 'failed', 'Template not found');
      return;
    }

    const whatsapp = new WhatsAppClient(user);

    for (const contact of contacts) {
      try {
        const response = await whatsapp.sendTemplateMessage({
          to: contact.phone,
          templateName: template.name,
          languageCode: template.language,
        });

        await this.messageRepo.create({
          campaign: { connect: { id: campaignId } },
          contact: { connect: { id: contact.id } },
          user: { connect: { id: userId } },
          whatsappMessageId: response.messages[0]?.id,
          direction: 'outbound',
          type: 'template',
          content: { templateId, templateName: template.name },
          status: 'sent',
          sentAt: new Date(),
        });

        await this.campaignRepo.incrementSentCount(campaignId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to send campaign message', { campaignId, contactId: contact.id, errorMessage });

        await this.messageRepo.create({
          campaign: { connect: { id: campaignId } },
          contact: { connect: { id: contact.id } },
          user: { connect: { id: userId } },
          direction: 'outbound',
          type: 'template',
          content: { templateId, templateName: template.name },
          status: 'failed',
          failedAt: new Date(),
          errorMessage,
        });

        await this.campaignRepo.incrementFailedCount(campaignId);
      }
    }

    await this.campaignRepo.updateStatus(campaignId, 'completed');
    logger.info('Campaign completed (sync)', { campaignId, userId, total: contacts.length });
  }

  async createCampaign(userId: string, data: CreateCampaignData): Promise<Campaign> {
    const template = await this.templateRepo.findById(data.templateId);

    if (!template) {
      throw new NotFoundError(`Template not found: ${data.templateId}`);
    }

    if (template.userId !== userId) {
      throw new ForbiddenError('Template does not belong to this user');
    }

    if (!SENDABLE_TEMPLATE_STATUSES.includes(template.status)) {
      throw new BadRequestError(
        `Template status must be one of: ${SENDABLE_TEMPLATE_STATUSES.join(', ')}. Current status: ${template.status}`,
      );
    }

    const campaign = await this.campaignRepo.create({
      name: data.name,
      messageType: 'template',
      messageContent: {
        contactFilter: data.contactFilter ?? {},
        ...(data.contactIds && { contactIds: data.contactIds }),
      } as unknown as Prisma.InputJsonValue,
      scheduledAt: data.scheduledAt,
      user: { connect: { id: userId } },
      template: { connect: { id: data.templateId } },
    });

    logger.info('Campaign created', { campaignId: campaign.id, userId });
    return campaign;
  }

  async getCampaignById(campaignId: string, userId: string): Promise<Campaign> {
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.userId !== userId) {
      throw new ForbiddenError('Campaign does not belong to this user');
    }

    return campaign;
  }

  async listCampaigns(params: ListCampaignsParams): Promise<{
    campaigns: Campaign[];
    total: number;
  }> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;

    const where: Prisma.CampaignWhereInput = { userId: params.userId };
    if (params.status) {
      where.status = params.status;
    }

    const [campaigns, total] = await Promise.all([
      this.campaignRepo.findAll({
        skip: offset,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.campaignRepo.count(where),
    ]);

    return { campaigns, total };
  }

  async updateCampaign(
    campaignId: string,
    userId: string,
    data: UpdateCampaignData,
  ): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, userId);

    if (campaign.status !== 'draft') {
      throw new BadRequestError('Only draft campaigns can be updated');
    }

    if (data.templateId) {
      const template = await this.templateRepo.findById(data.templateId);

      if (!template) {
        throw new NotFoundError(`Template not found: ${data.templateId}`);
      }

      if (template.userId !== userId) {
        throw new ForbiddenError('Template does not belong to this user');
      }

      if (!SENDABLE_TEMPLATE_STATUSES.includes(template.status)) {
        throw new BadRequestError(
          `Template status must be one of: ${SENDABLE_TEMPLATE_STATUSES.join(', ')}`,
        );
      }
    }

    const updateData: Prisma.CampaignUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt;
    if (data.templateId) updateData.template = { connect: { id: data.templateId } };

    if (data.contactFilter !== undefined || data.contactIds !== undefined) {
      const existing = campaign.messageContent as Record<string, unknown>;
      updateData.messageContent = {
        ...existing,
        ...(data.contactFilter !== undefined && { contactFilter: data.contactFilter }),
        ...(data.contactIds !== undefined && { contactIds: data.contactIds }),
      } as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.campaignRepo.update(campaignId, updateData);
    logger.info('Campaign updated', { campaignId, userId });
    return updated;
  }

  async deleteCampaign(campaignId: string, userId: string): Promise<void> {
    const campaign = await this.getCampaignById(campaignId, userId);

    if (campaign.status !== 'draft') {
      throw new BadRequestError('Only draft campaigns can be deleted');
    }

    await this.campaignRepo.delete(campaignId);
    logger.info('Campaign deleted', { campaignId, userId });
  }

  async startCampaign(campaignId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, userId);

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new BadRequestError(
        `Campaign must be in draft or scheduled status to start. Current: ${campaign.status}`,
      );
    }

    if (!campaign.templateId) {
      throw new BadRequestError('Campaign has no template assigned');
    }

    const messageContent = campaign.messageContent as Record<string, unknown>;
    const contactIds = messageContent?.contactIds as string[] | undefined;
    const contactFilter = (messageContent?.contactFilter ?? {}) as ContactFilter;

    let contacts;
    if (contactIds && contactIds.length > 0) {
      contacts = await this.contactRepo.findByIds(contactIds, userId);
    } else {
      contacts = await this.contactRepo.findByUserId(userId, {
        tags: contactFilter.tags,
      });
    }

    const activeContacts = contacts.filter((c) => !c.isBlocked);

    if (activeContacts.length === 0) {
      throw new BadRequestError('No contacts available for this campaign');
    }

    await this.campaignRepo.updateStatus(campaignId, 'processing');
    await this.campaignRepo.update(campaignId, { totalRecipients: activeContacts.length });

    if (campaignQueue) {
      // Enqueue jobs with batch pacing: every 50 jobs adds a 10-minute delay
      const jobs = activeContacts.map((contact, index) => {
        const batchIndex = Math.floor(index / BATCH_SIZE);
        const delay = batchIndex * BATCH_COOLDOWN_MS;

        return campaignQueue!.add(
          `send-${campaignId}-${contact.id}`,
          {
            campaignId,
            userId,
            contactId: contact.id,
            templateId: campaign.templateId!,
          },
          { delay },
        );
      });

      await Promise.all(jobs);
    } else {
      // Run synchronously in the background when Redis is unavailable
      this.runSynchronously(campaignId, userId, activeContacts, campaign.templateId!).catch(
        (err) => logger.error('Sync campaign execution failed', { campaignId, error: err.message }),
      );
    }

    logger.info('Campaign started', {
      campaignId,
      userId,
      totalRecipients: activeContacts.length,
    });

    return this.campaignRepo.findById(campaignId) as Promise<Campaign>;
  }

  async pauseCampaign(campaignId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, userId);

    if (campaign.status !== 'processing') {
      throw new BadRequestError('Only processing campaigns can be paused');
    }

    const updated = await this.campaignRepo.updateStatus(campaignId, 'paused');
    logger.info('Campaign paused', { campaignId, userId });
    return updated;
  }

  async cancelCampaign(campaignId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, userId);

    const cancellableStatuses: CampaignStatus[] = ['draft', 'scheduled', 'processing', 'paused'];
    if (!cancellableStatuses.includes(campaign.status)) {
      throw new BadRequestError(`Campaign in status ${campaign.status} cannot be cancelled`);
    }

    await campaignQueue?.drain();
    const updated = await this.campaignRepo.updateStatus(
      campaignId,
      'failed',
      'Cancelled by user',
    );
    logger.info('Campaign cancelled', { campaignId, userId });
    return updated;
  }

  async getCampaignStats(campaignId: string, userId: string): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    read: number;
    total: number;
  }> {
    const campaign = await this.getCampaignById(campaignId, userId);

    return {
      sent: campaign.sentCount,
      delivered: campaign.deliveredCount,
      failed: campaign.failedCount,
      read: campaign.readCount,
      total: campaign.totalRecipients,
    };
  }
}

export default new CampaignService();
