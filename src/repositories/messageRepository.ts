import { Message, Prisma, MessageStatus } from '@prisma/client';
import { BaseRepository } from './baseRepository';

export class MessageRepository extends BaseRepository<Message> {
  async findById(id: string): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id },
      include: {
        campaign: true,
        contact: true,
        user: true,
        webhookEvents: true,
      },
    });
  }

  async findByWhatsAppMessageId(whatsappMessageId: string): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { whatsappMessageId },
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: Prisma.MessageWhereInput;
    orderBy?: Prisma.MessageOrderByWithRelationInput;
  }): Promise<Message[]> {
    return this.prisma.message.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: options?.orderBy,
    });
  }

  async create(data: Prisma.MessageCreateInput): Promise<Message> {
    return this.prisma.message.create({
      data,
    });
  }

  async update(id: string, data: Prisma.MessageUpdateInput): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Message> {
    return this.prisma.message.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.MessageWhereInput): Promise<number> {
    return this.prisma.message.count({ where });
  }

  async findByCampaignId(
    campaignId: string,
    options?: {
      skip?: number;
      take?: number;
      status?: MessageStatus;
    },
  ): Promise<Message[]> {
    const where: Prisma.MessageWhereInput = { campaignId };

    if (options?.status) {
      where.status = options.status;
    }

    return this.prisma.message.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByContactId(
    contactId: string,
    options?: {
      skip?: number;
      take?: number;
    },
  ): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { contactId },
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserId(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      status?: MessageStatus;
    },
  ): Promise<Message[]> {
    const where: Prisma.MessageWhereInput = { userId };

    if (options?.status) {
      where.status = options.status;
    }

    return this.prisma.message.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(
    id: string,
    status: MessageStatus,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<Message> {
    const data: Prisma.MessageUpdateInput = { status };

    if (status === 'sent') {
      data.sentAt = new Date();
    } else if (status === 'delivered') {
      data.deliveredAt = new Date();
    } else if (status === 'read') {
      data.readAt = new Date();
    } else if (status === 'failed') {
      data.failedAt = new Date();
      if (errorCode) data.errorCode = errorCode;
      if (errorMessage) data.errorMessage = errorMessage;
    }

    return this.prisma.message.update({
      where: { id },
      data,
    });
  }

  async updateStatusByWhatsAppMessageId(
    whatsappMessageId: string,
    status: MessageStatus,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<Message | null> {
    const message = await this.findByWhatsAppMessageId(whatsappMessageId);
    if (!message) return null;

    return this.updateStatus(message.id, status, errorCode, errorMessage);
  }

  async incrementRetryCount(id: string): Promise<Message> {
    return this.prisma.message.update({
      where: { id },
      data: {
        retryCount: {
          increment: 1,
        },
      },
    });
  }

  async findQueuedMessages(limit?: number): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: {
        status: 'queued',
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findFailedMessages(
    options?: {
      maxRetries?: number;
      limit?: number;
    },
  ): Promise<Message[]> {
    const where: Prisma.MessageWhereInput = {
      status: 'failed',
    };

    if (options?.maxRetries !== undefined) {
      where.retryCount = {
        lt: options.maxRetries,
      };
    }

    return this.prisma.message.findMany({
      where,
      take: options?.limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  async bulkCreate(messages: Prisma.MessageCreateManyInput[]): Promise<number> {
    const result = await this.prisma.message.createMany({
      data: messages,
    });

    return result.count;
  }

  async getMessageStats(campaignId: string): Promise<{
    total: number;
    queued: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  }> {
    const [total, queued, sent, delivered, read, failed] = await Promise.all([
      this.prisma.message.count({ where: { campaignId } }),
      this.prisma.message.count({ where: { campaignId, status: 'queued' } }),
      this.prisma.message.count({ where: { campaignId, status: 'sent' } }),
      this.prisma.message.count({ where: { campaignId, status: 'delivered' } }),
      this.prisma.message.count({ where: { campaignId, status: 'read' } }),
      this.prisma.message.count({ where: { campaignId, status: 'failed' } }),
    ]);

    return {
      total, queued, sent, delivered, read, failed,
    };
  }
}

export default new MessageRepository();
