import { Campaign, Prisma, CampaignStatus } from '@prisma/client';
import { BaseRepository } from './baseRepository';

export class CampaignRepository extends BaseRepository<Campaign> {
  async findById(id: string): Promise<Campaign | null> {
    return this.prisma.campaign.findUnique({
      where: { id },
      include: {
        user: true,
        template: true,
        messages: true,
      },
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: Prisma.CampaignWhereInput;
    orderBy?: Prisma.CampaignOrderByWithRelationInput;
  }): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: options?.orderBy,
    });
  }

  async create(data: Prisma.CampaignCreateInput): Promise<Campaign> {
    return this.prisma.campaign.create({
      data,
    });
  }

  async update(id: string, data: Prisma.CampaignUpdateInput): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Campaign> {
    return this.prisma.campaign.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.CampaignWhereInput): Promise<number> {
    return this.prisma.campaign.count({ where });
  }

  async findByUserId(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      status?: CampaignStatus;
    }
  ): Promise<Campaign[]> {
    const where: Prisma.CampaignWhereInput = { userId };

    if (options?.status) {
      where.status = options.status;
    }

    return this.prisma.campaign.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findScheduledCampaigns(): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: new Date(),
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: CampaignStatus,
    errorMessage?: string
  ): Promise<Campaign> {
    const data: Prisma.CampaignUpdateInput = { status };

    if (status === 'processing') {
      data.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      data.completedAt = new Date();
    }

    if (errorMessage) {
      data.errorMessage = errorMessage;
    }

    return this.prisma.campaign.update({
      where: { id },
      data,
    });
  }

  async updateStats(
    id: string,
    stats: {
      sentCount?: number;
      deliveredCount?: number;
      failedCount?: number;
      readCount?: number;
    }
  ): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: stats,
    });
  }

  async incrementSentCount(id: string): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        sentCount: {
          increment: 1,
        },
      },
    });
  }

  async incrementDeliveredCount(id: string): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        deliveredCount: {
          increment: 1,
        },
      },
    });
  }

  async incrementFailedCount(id: string): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        failedCount: {
          increment: 1,
        },
      },
    });
  }

  async incrementReadCount(id: string): Promise<Campaign> {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        readCount: {
          increment: 1,
        },
      },
    });
  }

  async getCampaignStats(id: string): Promise<{
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    readCount: number;
  } | null> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        failedCount: true,
        readCount: true,
      },
    });

    return campaign;
  }
}

export default new CampaignRepository();
