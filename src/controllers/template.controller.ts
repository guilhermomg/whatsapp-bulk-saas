import { Request, Response } from 'express';
import { TemplateService } from '../services/templateService';
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesSchema,
  previewTemplateSchema,
  validateParametersSchema,
} from '../validators/templateValidator';
import { ValidationError, BadRequestError } from '../utils/errors';
import logger from '../config/logger';

const templateService = new TemplateService();

/**
 * @swagger
 * tags:
 *   name: Templates
 *   description: WhatsApp template management endpoints
 */

/**
 * @swagger
 * /templates:
 *   post:
 *     summary: Create a new template
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - name
 *               - category
 *               - components
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 pattern: '^[a-z0-9_]+$'
 *                 example: 'order_confirmation'
 *               language:
 *                 type: string
 *                 example: 'en_US'
 *               category:
 *                 type: string
 *                 enum: [marketing, utility, authentication]
 *               components:
 *                 type: object
 *                 properties:
 *                   header:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [text, image, video, document]
 *                       text:
 *                         type: string
 *                       url:
 *                         type: string
 *                   body:
 *                     type: object
 *                     required:
 *                       - text
 *                     properties:
 *                       text:
 *                         type: string
 *                       variables:
 *                         type: array
 *                         items:
 *                           type: string
 *                   footer:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                   buttons:
 *                     type: array
 *                     maxItems: 3
 *                     items:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                           enum: [url, phone, quick_reply]
 *                         text:
 *                           type: string
 *                         url:
 *                           type: string
 *                         phone_number:
 *                           type: string
 *     responses:
 *       201:
 *         description: Template created successfully
 *       409:
 *         description: Template name already exists
 *       422:
 *         description: Validation error
 */
export async function createTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { error, value } = createTemplateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const template = await templateService.createTemplate(value);

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error creating template:', error);
    throw error;
  }
}

/**
 * @swagger
 * /templates/{id}:
 *   get:
 *     summary: Get template by ID
 *     tags: [Templates]
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
 *         description: Template found
 *       404:
 *         description: Template not found
 */
export async function getTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const template = await templateService.getTemplateById(id, userId);

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error getting template:', error);
    throw error;
  }
}

/**
 * @swagger
 * /templates:
 *   get:
 *     summary: List templates with pagination and filters
 *     tags: [Templates]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, rejected]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [marketing, utility, authentication]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, status]
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *     responses:
 *       200:
 *         description: List of templates
 */
export async function listTemplates(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    // Validate query parameters
    const { error, value } = listTemplatesSchema.validate(
      { ...req.query, userId },
      {
        abortEarly: false,
        stripUnknown: true,
      },
    );

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const result = await templateService.listTemplates(value);

    res.status(200).json({
      success: true,
      data: result.templates,
      pagination: {
        total: result.total,
        limit: value.limit,
        offset: value.offset,
      },
    });
  } catch (error) {
    logger.error('Error listing templates:', error);
    throw error;
  }
}

/**
 * @swagger
 * /templates/{id}:
 *   put:
 *     summary: Update template
 *     tags: [Templates]
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
 *               name:
 *                 type: string
 *               language:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [marketing, utility, authentication]
 *               components:
 *                 type: object
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       400:
 *         description: Can only update draft templates
 *       404:
 *         description: Template not found
 *       409:
 *         description: Duplicate template name
 */
export async function updateTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const { error, value } = updateTemplateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const template = await templateService.updateTemplate(id, userId, value);

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Error updating template:', error);
    throw error;
  }
}

/**
 * @swagger
 * /templates/{id}:
 *   delete:
 *     summary: Delete template
 *     tags: [Templates]
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
 *         description: Template deleted successfully
 *       404:
 *         description: Template not found
 */
export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    await templateService.deleteTemplate(id, userId);

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting template:', error);
    throw error;
  }
}

/**
 * @swagger
 * /templates/{id}/preview:
 *   post:
 *     summary: Preview template with parameters
 *     tags: [Templates]
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
 *               parameters:
 *                 type: object
 *                 additionalProperties: true
 *                 example:
 *                   customer_name: 'John Doe'
 *                   order_id: '12345'
 *     responses:
 *       200:
 *         description: Template preview generated
 *       404:
 *         description: Template not found
 */
export async function previewTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const { error, value } = previewTemplateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const preview = await templateService.previewTemplate(
      id,
      userId,
      value.parameters,
    );

    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    logger.error('Error previewing template:', error);
    throw error;
  }
}

/**
 * @swagger
 * /templates/{id}/validate:
 *   post:
 *     summary: Validate template parameters
 *     tags: [Templates]
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
 *               - parameters
 *             properties:
 *               parameters:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Validation result
 *       404:
 *         description: Template not found
 */
export async function validateTemplateParameters(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId: string };

    if (!userId) {
      throw new BadRequestError('userId query parameter is required');
    }

    const { error, value } = validateParametersSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(errorMessage);
    }

    const validation = await templateService.validateParameters(
      id,
      userId,
      value.parameters,
    );

    res.status(200).json({
      success: true,
      data: validation,
    });
  } catch (error) {
    logger.error('Error validating template parameters:', error);
    throw error;
  }
}

/**
 * @swagger
 * /templates/sync:
 *   post:
 *     summary: Sync templates from Meta WhatsApp API
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - wabaId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               wabaId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Templates synced successfully
 *       502:
 *         description: Meta API error
 */
export async function syncTemplates(req: Request, res: Response): Promise<void> {
  try {
    const { userId, wabaId } = req.body;

    if (!userId) {
      throw new BadRequestError('userId is required');
    }

    if (!wabaId) {
      throw new BadRequestError('wabaId is required');
    }

    const result = await templateService.syncTemplatesFromMeta(userId, wabaId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error syncing templates:', error);
    throw error;
  }
}
