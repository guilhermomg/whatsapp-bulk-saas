import { Contact, Prisma } from '@prisma/client';
import { ContactRepository } from '../repositories/contactRepository';
import { validateAndFormatPhoneNumber } from '../validators/phoneValidator';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  BadRequestError,
} from '../utils/errors';
import prisma from '../utils/prisma';
import logger from '../config/logger';

/**
 * Contact Service
 * Handles business logic for contact management
 */
export class ContactService {
  private contactRepository: ContactRepository;

  constructor(contactRepository?: ContactRepository) {
    this.contactRepository = contactRepository || new ContactRepository();
  }

  /**
   * Create a new contact
   */
  async createContact(data: {
    userId: string;
    phone: string;
    name?: string;
    email?: string;
    tags?: string[];
    metadata?: any;
    optedIn?: boolean;
    optInSource?: 'manual' | 'csv' | 'api' | 'webhook';
  }): Promise<Contact> {
    try {
      // Validate and format phone number to E.164
      const formattedPhone = validateAndFormatPhoneNumber(data.phone);

      // Check for duplicate
      const existing = await this.contactRepository.findByPhone(data.userId, formattedPhone);
      if (existing) {
        throw new ConflictError(
          `Contact with phone number ${formattedPhone} already exists for this user`,
        );
      }

      // Create contact
      const contact = await this.contactRepository.create({
        user: { connect: { id: data.userId } },
        phone: formattedPhone,
        name: data.name || null,
        email: data.email || null,
        tags: data.tags || [],
        metadata: data.metadata || null,
        optedIn: data.optedIn || false,
        optedInAt: data.optedIn ? new Date() : null,
        optInSource: data.optInSource || null,
      });

      logger.info(`Contact created: ${contact.id} with phone ${formattedPhone}`);
      return contact;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error creating contact:', error);
      throw new Error(`Failed to create contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get contact by ID
   */
  async getContactById(id: string, userId: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(id);

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    // Ensure contact belongs to user
    if (contact.userId !== userId) {
      throw new NotFoundError('Contact not found');
    }

    return contact;
  }

  /**
   * List contacts with pagination and filters
   */
  async listContacts(params: {
    userId: string;
    limit?: number;
    offset?: number;
    search?: string;
    optedIn?: boolean;
    tags?: string | string[];
    isBlocked?: boolean;
    sortBy?: 'createdAt' | 'name' | 'phone' | 'updatedAt';
    order?: 'asc' | 'desc';
    createdAfter?: Date;
    createdBefore?: Date;
  }): Promise<{ contacts: Contact[]; total: number }> {
    const {
      userId,
      limit = 30,
      offset = 0,
      search,
      optedIn,
      tags,
      isBlocked,
      sortBy = 'createdAt',
      order = 'desc',
      createdAfter,
      createdBefore,
    } = params;

    // Build where clause
    const where: Prisma.ContactWhereInput = {
      userId,
    };

    // Filter by opt-in status
    if (optedIn !== undefined) {
      where.optedIn = optedIn;
    }

    // Filter by blocked status
    if (isBlocked !== undefined) {
      where.isBlocked = isBlocked;
    }

    // Filter by tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      where.tags = { hasSome: tagArray };
    }

    // Search by name or phone
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Date range filters
    if (createdAfter || createdBefore) {
      where.createdAt = {};
      if (createdAfter) {
        where.createdAt.gte = createdAfter;
      }
      if (createdBefore) {
        where.createdAt.lte = createdBefore;
      }
    }

    // Get total count
    const total = await this.contactRepository.count(where);

    // Get contacts with pagination
    const contacts = await this.contactRepository.findAll({
      where,
      skip: offset,
      take: limit,
      orderBy: { [sortBy]: order },
    });

    return { contacts, total };
  }

  /**
   * Update contact
   */
  async updateContact(
    id: string,
    userId: string,
    data: {
      phone?: string;
      name?: string;
      email?: string;
      tags?: string[];
      metadata?: any;
    },
  ): Promise<Contact> {
    // Verify contact exists and belongs to user
    await this.getContactById(id, userId);

    const updateData: Prisma.ContactUpdateInput = {};

    // Validate and format phone if provided
    if (data.phone) {
      const formattedPhone = validateAndFormatPhoneNumber(data.phone);

      // Check if new phone already exists for this user (excluding current contact)
      const existing = await this.contactRepository.findByPhone(userId, formattedPhone);
      if (existing && existing.id !== id) {
        throw new ConflictError(
          `Contact with phone number ${formattedPhone} already exists for this user`,
        );
      }

      updateData.phone = formattedPhone;
    }

    if (data.name !== undefined) {
      updateData.name = data.name || null;
    }

    if (data.email !== undefined) {
      updateData.email = data.email || null;
    }

    if (data.tags !== undefined) {
      updateData.tags = data.tags;
    }

    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata || null;
    }

    const contact = await this.contactRepository.update(id, updateData);

    logger.info(`Contact updated: ${contact.id}`);
    return contact;
  }

  /**
   * Delete contact (soft delete recommended)
   */
  async deleteContact(id: string, userId: string): Promise<void> {
    // Verify contact exists and belongs to user
    await this.getContactById(id, userId);

    await this.contactRepository.delete(id);

    logger.info(`Contact deleted: ${id}`);
  }

  /**
   * Opt-in single contact
   */
  async optInContact(
    id: string,
    userId: string,
    optInSource: 'manual' | 'csv' | 'api' | 'webhook' = 'manual',
  ): Promise<Contact> {
    // Verify contact exists and belongs to user
    await this.getContactById(id, userId);

    const contact = await this.contactRepository.update(id, {
      optedIn: true,
      optedInAt: new Date(),
      optedOutAt: null,
      optInSource,
    });

    logger.info(`Contact opted in: ${id}`);
    return contact;
  }

  /**
   * Opt-out single contact
   */
  async optOutContact(id: string, userId: string, reason?: string): Promise<Contact> {
    // Verify contact exists and belongs to user
    await this.getContactById(id, userId);

    const updateData: Prisma.ContactUpdateInput = {
      optedIn: false,
      optedOutAt: new Date(),
    };

    // Store reason in metadata if provided
    if (reason) {
      const existingContact = await this.contactRepository.findById(id);
      const existingMetadata = existingContact?.metadata || {};
      updateData.metadata = {
        ...(typeof existingMetadata === 'object' && existingMetadata !== null ? existingMetadata : {}),
        optOutReason: reason,
      };
    }

    const contact = await this.contactRepository.update(id, updateData);

    logger.info(`Contact opted out: ${id}`);
    return contact;
  }

  /**
   * Bulk opt-in contacts
   */
  async bulkOptIn(
    contactIds: string[],
    userId: string,
    optInSource: 'manual' | 'csv' | 'api' | 'webhook' = 'api',
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    await prisma.$transaction(async (tx: any) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const contactId of contactIds) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const contact = await tx.contact.findUnique({
            where: { id: contactId },
          });

          if (!contact || contact.userId !== userId) {
            failed += 1;
            // eslint-disable-next-line no-continue
            continue;
          }

          // eslint-disable-next-line no-await-in-loop
          await tx.contact.update({
            where: { id: contactId },
            data: {
              optedIn: true,
              optedInAt: new Date(),
              optedOutAt: null,
              optInSource,
            },
          });

          success += 1;
        } catch (error) {
          logger.error(`Error opting in contact ${contactId}:`, error);
          failed += 1;
        }
      }
    });

    logger.info(`Bulk opt-in completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Bulk opt-out contacts
   */
  async bulkOptOut(
    contactIds: string[],
    userId: string,
    reason?: string,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    await prisma.$transaction(async (tx: any) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const contactId of contactIds) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const contact = await tx.contact.findUnique({
            where: { id: contactId },
          });

          if (!contact || contact.userId !== userId) {
            failed += 1;
            // eslint-disable-next-line no-continue
            continue;
          }

          const updateData: any = {
            optedIn: false,
            optedOutAt: new Date(),
          };

          if (reason) {
            updateData.metadata = {
              ...(contact.metadata || {}),
              optOutReason: reason,
            };
          }

          // eslint-disable-next-line no-await-in-loop
          await tx.contact.update({
            where: { id: contactId },
            data: updateData,
          });

          success += 1;
        } catch (error) {
          logger.error(`Error opting out contact ${contactId}:`, error);
          failed += 1;
        }
      }
    });

    logger.info(`Bulk opt-out completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Update tags for a contact
   */
  async updateTags(
    id: string,
    userId: string,
    action: 'add' | 'remove' | 'set',
    tags: string[],
  ): Promise<Contact> {
    // Verify contact exists and belongs to user
    const contact = await this.getContactById(id, userId);

    let newTags: string[];

    switch (action) {
      case 'add':
        // Add tags (avoid duplicates)
        newTags = Array.from(new Set([...contact.tags, ...tags]));
        break;
      case 'remove':
        // Remove tags
        newTags = contact.tags.filter((tag: string) => !tags.includes(tag));
        break;
      case 'set':
        // Replace all tags
        newTags = tags;
        break;
      default:
        throw new BadRequestError('Invalid action. Must be add, remove, or set');
    }

    const updatedContact = await this.contactRepository.update(id, { tags: newTags });

    logger.info(`Contact tags updated: ${id}, action: ${action}`);
    return updatedContact;
  }

  /**
   * Bulk tag operations
   */
  async bulkTag(
    contactIds: string[],
    userId: string,
    tags: string[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    await prisma.$transaction(async (tx: any) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const contactId of contactIds) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const contact = await tx.contact.findUnique({
            where: { id: contactId },
          });

          if (!contact || contact.userId !== userId) {
            failed += 1;
            // eslint-disable-next-line no-continue
            continue;
          }

          // Add tags (avoid duplicates)
          const newTags = Array.from(new Set([...contact.tags, ...tags]));

          // eslint-disable-next-line no-await-in-loop
          await tx.contact.update({
            where: { id: contactId },
            data: { tags: newTags },
          });

          success += 1;
        } catch (error) {
          logger.error(`Error tagging contact ${contactId}:`, error);
          failed += 1;
        }
      }
    });

    logger.info(`Bulk tag completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Bulk untag operations
   */
  async bulkUntag(
    contactIds: string[],
    userId: string,
    tags: string[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    await prisma.$transaction(async (tx: any) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const contactId of contactIds) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const contact = await tx.contact.findUnique({
            where: { id: contactId },
          });

          if (!contact || contact.userId !== userId) {
            failed += 1;
            // eslint-disable-next-line no-continue
            continue;
          }

          // Remove tags
          const newTags = contact.tags.filter((tag: string) => !tags.includes(tag));

          // eslint-disable-next-line no-await-in-loop
          await tx.contact.update({
            where: { id: contactId },
            data: { tags: newTags },
          });

          success += 1;
        } catch (error) {
          logger.error(`Error untagging contact ${contactId}:`, error);
          failed += 1;
        }
      }
    });

    logger.info(`Bulk untag completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * Get all unique tags for a user
   */
  async getAllTags(userId: string): Promise<{ tag: string; count: number }[]> {
    const contacts = await this.contactRepository.findByUserId(userId);

    // Count occurrences of each tag
    const tagCounts = new Map<string, number>();

    contacts.forEach((contact) => {
      contact.tags.forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // Convert to array and sort by count (descending)
    const tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    return tags;
  }
}

export default new ContactService();
