import { WebhookEvent, Prisma } from '@prisma/client';
import { BaseRepository } from './baseRepository';

export class WebhookEventRepository extends BaseRepository<WebhookEvent> {
  async findById(id: string): Promise<WebhookEvent | null> {
    return this.prisma.webhookEvent.findUnique({
      where: { id },
      include: {
        user: true,
        message: true,
      },
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: Prisma.WebhookEventWhereInput;
    orderBy?: Prisma.WebhookEventOrderByWithRelationInput;
  }): Promise<WebhookEvent[]> {
    return this.prisma.webhookEvent.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: options?.orderBy,
    });
  }

  async create(data: Prisma.WebhookEventCreateInput): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.create({
      data,
    });
  }

  async update(id: string, data: Prisma.WebhookEventUpdateInput): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.WebhookEventWhereInput): Promise<number> {
    return this.prisma.webhookEvent.count({ where });
  }

  async findByEventType(
    eventType: string,
    options?: {
      skip?: number;
      take?: number;
      processed?: boolean;
    }
  ): Promise<WebhookEvent[]> {
    const where: Prisma.WebhookEventWhereInput = { eventType };

    if (options?.processed !== undefined) {
      where.processed = options.processed;
    }

    return this.prisma.webhookEvent.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { receivedAt: 'desc' },
    });
  }

  async findUnprocessedEvents(limit?: number): Promise<WebhookEvent[]> {
    return this.prisma.webhookEvent.findMany({
      where: {
        processed: false,
      },
      take: limit,
      orderBy: { receivedAt: 'asc' },
    });
  }

  async markAsProcessed(id: string): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });
  }

  async markAsFailed(id: string, errorMessage: string): Promise<WebhookEvent> {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        processed: false,
        errorMessage,
      },
    });
  }

  async findByMessageId(messageId: string): Promise<WebhookEvent[]> {
    return this.prisma.webhookEvent.findMany({
      where: { messageId },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async findByUserId(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      eventType?: string;
      processed?: boolean;
    }
  ): Promise<WebhookEvent[]> {
    const where: Prisma.WebhookEventWhereInput = { userId };

    if (options?.eventType) {
      where.eventType = options.eventType;
    }

    if (options?.processed !== undefined) {
      where.processed = options.processed;
    }

    return this.prisma.webhookEvent.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { receivedAt: 'desc' },
    });
  }

  async bulkCreate(events: Prisma.WebhookEventCreateManyInput[]): Promise<number> {
    const result = await this.prisma.webhookEvent.createMany({
      data: events,
    });

    return result.count;
  }

  async deleteOldEvents(daysOld: number): Promise<number> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysOld);

    const result = await this.prisma.webhookEvent.deleteMany({
      where: {
        receivedAt: {
          lt: dateThreshold,
        },
        processed: true,
      },
    });

    return result.count;
  }
}

export default new WebhookEventRepository();
