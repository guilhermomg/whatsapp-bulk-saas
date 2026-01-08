import { Request, Response } from 'express';
import { ContactService } from '../services/contactService';
import { CsvService } from '../services/csvService';
import {
  createContactSchema,
  updateContactSchema,
  listContactsSchema,
  optInSchema,
  optOutSchema,
  bulkOptInSchema,
  bulkOptOutSchema,
  updateTagsSchema,
  bulkTagSchema,
} from '../validators/contactValidator';
import { ValidationError, BadRequestError } from '../utils/errors';
import logger from '../config/logger';

const contactService = new ContactService();
const csvService = new CsvService();

/**
 * @swagger
 * tags:
 *   name: Contacts
 *   description: Contact management endpoints
 */

/**
 * @swagger
 * /contacts:
 *   post:
 *     summary: Create a new contact
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - phone
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               phone:
 *                 type: string
 *                 example: "+14155552671"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *               optedIn:
 *                 type: boolean
 *               optInSource:
 *                 type: string
 *                 enum: [manual, csv, api, webhook]
 *     responses:
 *       201:
 *         description: Contact created successfully
 *       409:
 *         description: Contact already exists
 *       422:
 *         description: Validation error
 */
export async function createContact(req: Request, res: Response): Promise<void> {
  try {
    const { error, value } = createContactSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const contact = await contactService.createContact(value);

    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.error('Error creating contact:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/{id}:
 *   get:
 *     summary: Get contact by ID
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Contact found
 *       404:
 *         description: Contact not found
 */
export async function getContact(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const contact = await contactService.getContactById(id, userId);

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.error('Error getting contact:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts:
 *   get:
 *     summary: List contacts with pagination and filters
 *     tags: [Contacts]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: optedIn
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, name, phone, updatedAt]
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: List of contacts
 */
export async function listContacts(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    // Validate query parameters
    const { error, value } = listContactsSchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    // Parse tags if string
    let { tags } = value;
    if (tags && typeof tags === 'string') {
      tags = tags.split(',').map((tag: string) => tag.trim());
    }

    const result = await contactService.listContacts({
      userId,
      ...value,
      tags,
    });

    res.status(200).json({
      success: true,
      data: result.contacts,
      pagination: {
        total: result.total,
        limit: value.limit,
        offset: value.offset,
      },
    });
  } catch (error) {
    logger.error('Error listing contacts:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/{id}:
 *   put:
 *     summary: Update contact
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *       404:
 *         description: Contact not found
 *       409:
 *         description: Duplicate phone number
 */
export async function updateContact(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const { error, value } = updateContactSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const contact = await contactService.updateContact(id, userId, value);

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.error('Error updating contact:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/{id}:
 *   delete:
 *     summary: Delete contact
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *       404:
 *         description: Contact not found
 */
export async function deleteContact(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    await contactService.deleteContact(id, userId);

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting contact:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/{id}/opt-in:
 *   post:
 *     summary: Opt-in a contact
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               optInSource:
 *                 type: string
 *                 enum: [manual, csv, api, webhook]
 *     responses:
 *       200:
 *         description: Contact opted in successfully
 *       404:
 *         description: Contact not found
 */
export async function optInContact(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const { error, value } = optInSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const contact = await contactService.optInContact(id, userId, value.optInSource);

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.error('Error opting in contact:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/{id}/opt-out:
 *   post:
 *     summary: Opt-out a contact
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contact opted out successfully
 *       404:
 *         description: Contact not found
 */
export async function optOutContact(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const { error, value } = optOutSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const contact = await contactService.optOutContact(id, userId, value.reason);

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.error('Error opting out contact:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/bulk-opt-in:
 *   post:
 *     summary: Bulk opt-in contacts
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - contactIds
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               contactIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               optInSource:
 *                 type: string
 *                 enum: [manual, csv, api, webhook]
 *     responses:
 *       200:
 *         description: Bulk opt-in completed
 */
export async function bulkOptIn(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;

    if (!userId) {
      throw new BadRequestError('userId is required');
    }

    const { error, value } = bulkOptInSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const result = await contactService.bulkOptIn(
      value.contactIds,
      userId,
      value.optInSource,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error bulk opting in contacts:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/bulk-opt-out:
 *   post:
 *     summary: Bulk opt-out contacts
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - contactIds
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               contactIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bulk opt-out completed
 */
export async function bulkOptOut(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;

    if (!userId) {
      throw new BadRequestError('userId is required');
    }

    const { error, value } = bulkOptOutSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const result = await contactService.bulkOptOut(
      value.contactIds,
      userId,
      value.reason,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error bulk opting out contacts:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/{id}/tags:
 *   patch:
 *     summary: Update contact tags
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - tags
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [add, remove, set]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Tags updated successfully
 *       404:
 *         description: Contact not found
 */
export async function updateContactTags(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const { error, value } = updateTagsSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const contact = await contactService.updateTags(
      id,
      userId,
      value.action,
      value.tags,
    );

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    logger.error('Error updating contact tags:', error);
    throw error;
  }
}

/**
 * @swagger
 * /tags:
 *   get:
 *     summary: Get all tags with counts
 *     tags: [Contacts]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of tags with counts
 */
export async function getAllTags(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const tags = await contactService.getAllTags(userId);

    res.status(200).json({
      success: true,
      data: tags,
    });
  } catch (error) {
    logger.error('Error getting tags:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/bulk-tag:
 *   post:
 *     summary: Bulk add tags to contacts
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - contactIds
 *               - tags
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               contactIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk tag completed
 */
export async function bulkTag(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;

    if (!userId) {
      throw new BadRequestError('userId is required');
    }

    const { error, value } = bulkTagSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const result = await contactService.bulkTag(
      value.contactIds,
      userId,
      value.tags,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error bulk tagging contacts:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/bulk-untag:
 *   delete:
 *     summary: Bulk remove tags from contacts
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - contactIds
 *               - tags
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               contactIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk untag completed
 */
export async function bulkUntag(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;

    if (!userId) {
      throw new BadRequestError('userId is required');
    }

    const { error, value } = bulkTagSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const result = await contactService.bulkUntag(
      value.contactIds,
      userId,
      value.tags,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error bulk untagging contacts:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/import-csv:
 *   post:
 *     summary: Import contacts from CSV file
 *     tags: [Contacts]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: CSV file with contacts
 *     responses:
 *       200:
 *         description: CSV import completed
 *       400:
 *         description: Invalid file or validation error
 */
export async function importCsv(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    if (!req.file) {
      throw new BadRequestError('CSV file is required');
    }

    const result = await csvService.importCsv(userId, req.file.buffer);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error importing CSV:', error);
    throw error;
  }
}

/**
 * @swagger
 * /contacts/export-csv:
 *   get:
 *     summary: Export contacts to CSV file
 *     tags: [Contacts]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: optedIn
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
export async function exportCsv(req: Request, res: Response): Promise<void> {
  try {
    const {
      userId, optedIn, tags, search, isBlocked,
    } = req.query as {
      userId: string;
      optedIn?: string;
      tags?: string;
      search?: string;
      isBlocked?: string;
    };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    // Parse tags if string
    let parsedTags: string[] | undefined;
    if (tags) {
      parsedTags = tags.split(',').map((tag) => tag.trim());
    }

    // Parse boolean strings safely
    const parsedOptedIn = optedIn !== undefined ? optedIn === 'true' : undefined;
    const parsedIsBlocked = isBlocked !== undefined ? isBlocked === 'true' : undefined;

    const csvStream = await csvService.exportCsv({
      userId,
      optedIn: parsedOptedIn,
      tags: parsedTags,
      search,
      isBlocked: parsedIsBlocked,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');

    csvStream.pipe(res);
  } catch (error) {
    logger.error('Error exporting CSV:', error);
    throw error;
  }
}
