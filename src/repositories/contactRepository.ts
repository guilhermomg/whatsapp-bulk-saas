import { Contact, Prisma } from '@prisma/client';
import { BaseRepository } from './baseRepository';

export class ContactRepository extends BaseRepository<Contact> {
  async findById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
  }

  async findByPhone(userId: string, phone: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: {
        userId_phone: {
          userId,
          phone,
        },
      },
    });
  }

  async findAll(options?: {
    skip?: number;
    take?: number;
    where?: Prisma.ContactWhereInput;
    orderBy?: Prisma.ContactOrderByWithRelationInput;
  }): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: options?.orderBy,
    });
  }

  async create(data: Prisma.ContactCreateInput): Promise<Contact> {
    return this.prisma.contact.create({
      data,
    });
  }

  async update(id: string, data: Prisma.ContactUpdateInput): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Contact> {
    return this.prisma.contact.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.ContactWhereInput): Promise<number> {
    return this.prisma.contact.count({ where });
  }

  async findByUserId(
    userId: string,
    options?: {
      skip?: number;
      take?: number;
      optedIn?: boolean;
      tags?: string[];
    }
  ): Promise<Contact[]> {
    const where: Prisma.ContactWhereInput = { userId };

    if (options?.optedIn !== undefined) {
      where.optedIn = options.optedIn;
    }

    if (options?.tags && options.tags.length > 0) {
      where.tags = { hasSome: options.tags };
    }

    return this.prisma.contact.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOptedInContacts(userId: string): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: {
        userId,
        optedIn: true,
        isBlocked: false,
      },
    });
  }

  async bulkCreate(contacts: Prisma.ContactCreateManyInput[]): Promise<number> {
    const result = await this.prisma.contact.createMany({
      data: contacts,
      skipDuplicates: true,
    });

    return result.count;
  }

  async updateOptInStatus(
    id: string,
    optedIn: boolean
  ): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data: {
        optedIn,
        optedInAt: optedIn ? new Date() : null,
        optedOutAt: !optedIn ? new Date() : null,
      },
    });
  }

  async blockContact(id: string, reason: string): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data: {
        isBlocked: true,
        blockedReason: reason,
      },
    });
  }

  async unblockContact(id: string): Promise<Contact> {
    return this.prisma.contact.update({
      where: { id },
      data: {
        isBlocked: false,
        blockedReason: null,
      },
    });
  }

  async findByTags(userId: string, tags: string[]): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: {
        userId,
        tags: { hasSome: tags },
      },
    });
  }
}

export default new ContactRepository();
