import { Template, Prisma, TemplateStatus } from '@prisma/client';
import { BaseRepository } from './baseRepository';

export class TemplateRepository extends BaseRepository<Template> {
  async findById(id: string): Promise<Template | null> {
    return this.prisma.template.findUnique({
      where: { id },
      include: {
        user: true,
        campaigns: true,
      },
    });
  }

  async findByName(userId: string, name: string): Promise<Template | null> {
    return this.prisma.template.findUnique({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: Prisma.TemplateWhereInput;
    orderBy?: Prisma.TemplateOrderByWithRelationInput;
  }): Promise<Template[]> {
    return this.prisma.template.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: options?.orderBy,
    });
  }

  async create(data: Prisma.TemplateCreateInput): Promise<Template> {
    return this.prisma.template.create({
      data,
    });
  }

  async update(id: string, data: Prisma.TemplateUpdateInput): Promise<Template> {
    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Template> {
    return this.prisma.template.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.TemplateWhereInput): Promise<number> {
    return this.prisma.template.count({ where });
  }

  async findByUserId(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      status?: TemplateStatus;
    }
  ): Promise<Template[]> {
    const where: Prisma.TemplateWhereInput = { userId };

    if (options?.status) {
      where.status = options.status;
    }

    return this.prisma.template.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findApprovedTemplates(userId: string): Promise<Template[]> {
    return this.prisma.template.findMany({
      where: {
        userId,
        status: 'approved',
      },
    });
  }

  async updateStatus(
    id: string,
    status: TemplateStatus,
    rejectionReason?: string
  ): Promise<Template> {
    const data: Prisma.TemplateUpdateInput = {
      status,
    };

    if (status === 'approved') {
      data.approvedAt = new Date();
      data.rejectionReason = null;
    } else if (status === 'rejected' && rejectionReason) {
      data.rejectionReason = rejectionReason;
    }

    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async linkWhatsAppTemplate(
    id: string,
    whatsappTemplateId: string
  ): Promise<Template> {
    return this.prisma.template.update({
      where: { id },
      data: { whatsappTemplateId },
    });
  }
}

export default new TemplateRepository();
