import {
  Template, TemplateCategory, TemplateStatus, Prisma,
} from '@prisma/client';
import { TemplateRepository } from '../repositories/templateRepository';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  BadRequestError,
  WhatsAppError,
} from '../utils/errors';
import logger from '../config/logger';

interface TemplateComponents {
  header?: {
    type: string;
    text?: string;
    url?: string;
  };
  body: {
    text: string;
    variables?: string[];
  };
  footer?: {
    text: string;
  };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface CreateTemplateData {
  userId: string;
  name: string;
  language?: string;
  category: TemplateCategory;
  components: TemplateComponents;
}

interface UpdateTemplateData {
  name?: string;
  language?: string;
  category?: TemplateCategory;
  components?: TemplateComponents;
}

interface ListTemplatesParams {
  userId: string;
  limit?: number;
  offset?: number;
  status?: TemplateStatus;
  category?: TemplateCategory;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

interface PreviewResult {
  header?: string;
  body: string;
  footer?: string;
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  expectedParameters: string[];
  providedParameters: string[];
}

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: any;
  rejected_reason?: string;
}

/**
 * Template Service
 * Handles business logic for template management
 */
export class TemplateService {
  private templateRepository: TemplateRepository;

  constructor(
    templateRepository?: TemplateRepository,
  ) {
    this.templateRepository = templateRepository || new TemplateRepository();
  }

  /**
   * Extract variable placeholders from template text
   * Matches {{1}}, {{2}}, etc.
   */
  private extractVariables(text: string): number[] {
    const regex = /\{\{(\d+)\}\}/g;
    const variables: number[] = [];
    let match;

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(text)) !== null) {
      variables.push(parseInt(match[1], 10));
    }

    // Sort and deduplicate
    return [...new Set(variables)].sort((a, b) => a - b);
  }

  /**
   * Validate that variables are sequential starting from 1
   */
  private validateVariableSequence(variables: number[]): void {
    if (variables.length === 0) {
      return;
    }

    for (let i = 0; i < variables.length; i += 1) {
      if (variables[i] !== i + 1) {
        throw new ValidationError(
          `Template variables must be sequential starting from {{1}}. Found {{${variables[i]}}} but expected {{${i + 1}}}`,
        );
      }
    }
  }

  /**
   * Validate template components structure
   */
  private validateTemplateComponents(components: TemplateComponents): void {
    // Validate body variables
    const bodyVariables = this.extractVariables(components.body.text);
    this.validateVariableSequence(bodyVariables);

    // Ensure body text doesn't exceed WhatsApp limit
    if (components.body.text.length > 1024) {
      throw new ValidationError('Template body text must not exceed 1024 characters');
    }

    // Validate header if present
    if (components.header?.text) {
      if (components.header.text.length > 60) {
        throw new ValidationError('Header text must not exceed 60 characters');
      }
    }

    // Validate footer if present
    if (components.footer?.text) {
      if (components.footer.text.length > 60) {
        throw new ValidationError('Footer text must not exceed 60 characters');
      }
    }

    // Validate buttons if present
    if (components.buttons) {
      if (components.buttons.length > 3) {
        throw new ValidationError('Maximum 3 buttons allowed per template');
      }

      components.buttons.forEach((button, index) => {
        if (button.text.length > 25) {
          throw new ValidationError(`Button ${index + 1} text must not exceed 25 characters`);
        }
      });
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(data: CreateTemplateData): Promise<Template> {
    try {
      // Validate components structure
      this.validateTemplateComponents(data.components);

      // Check for duplicate template name for this user
      const existing = await this.templateRepository.findByName(data.userId, data.name);
      if (existing) {
        throw new ConflictError(
          `Template with name "${data.name}" already exists for this user`,
        );
      }

      // Create template with draft status
      const template = await this.templateRepository.create({
        user: { connect: { id: data.userId } },
        name: data.name,
        language: data.language || 'en_US',
        category: data.category,
        status: 'draft',
        components: data.components as unknown as Prisma.JsonObject,
      });

      logger.info(`Template created: ${template.id} with name ${template.name}`);
      return template;
    } catch (error) {
      if (
        error instanceof ConflictError
        || error instanceof ValidationError
      ) {
        throw error;
      }
      logger.error('Error creating template:', error);
      throw new Error(
        `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string, userId: string): Promise<Template> {
    const template = await this.templateRepository.findById(id);

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // Ensure template belongs to user
    if (template.userId !== userId) {
      throw new NotFoundError('Template not found');
    }

    return template;
  }

  /**
   * List templates with pagination and filters
   */
  async listTemplates(params: ListTemplatesParams): Promise<{
    templates: Template[];
    total: number;
  }> {
    const {
      userId,
      limit = 30,
      offset = 0,
      status,
      category,
      search,
      sortBy = 'createdAt',
      order = 'desc',
    } = params;

    // Build where clause
    const where: Prisma.TemplateWhereInput = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Build orderBy
    const orderBy: Prisma.TemplateOrderByWithRelationInput = {
      [sortBy]: order,
    };

    // Get templates and total count
    const [templates, total] = await Promise.all([
      this.templateRepository.findAll({
        skip: offset,
        take: limit,
        where,
        orderBy,
      }),
      this.templateRepository.count(where),
    ]);

    return { templates, total };
  }

  /**
   * Update template
   */
  async updateTemplate(
    id: string,
    userId: string,
    data: UpdateTemplateData,
  ): Promise<Template> {
    try {
      // Check template exists and belongs to user
      const existing = await this.getTemplateById(id, userId);

      // Can only update draft templates
      if (existing.status !== 'draft') {
        throw new BadRequestError('Can only update templates in draft status');
      }

      // Validate components if provided
      if (data.components) {
        this.validateTemplateComponents(data.components);
      }

      // Check for duplicate name if changing name
      if (data.name && data.name !== existing.name) {
        const duplicate = await this.templateRepository.findByName(userId, data.name);
        if (duplicate) {
          throw new ConflictError(
            `Template with name "${data.name}" already exists for this user`,
          );
        }
      }

      // Update template
      const updateData: Prisma.TemplateUpdateInput = {};

      if (data.name) updateData.name = data.name;
      if (data.language) updateData.language = data.language;
      if (data.category) updateData.category = data.category;
      if (data.components) {
        updateData.components = data.components as unknown as Prisma.JsonObject;
      }

      const template = await this.templateRepository.update(id, updateData);

      logger.info(`Template updated: ${template.id}`);
      return template;
    } catch (error) {
      if (
        error instanceof NotFoundError
        || error instanceof BadRequestError
        || error instanceof ConflictError
        || error instanceof ValidationError
      ) {
        throw error;
      }
      logger.error('Error updating template:', error);
      throw new Error(
        `Failed to update template: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string, userId: string): Promise<void> {
    // Check template exists and belongs to user
    await this.getTemplateById(id, userId);

    await this.templateRepository.delete(id);

    logger.info(`Template deleted: ${id}`);
  }

  /**
   * Preview template with provided parameters
   */
  async previewTemplate(
    id: string,
    userId: string,
    parameters: Record<string, string | number>,
  ): Promise<PreviewResult> {
    const template = await this.getTemplateById(id, userId);
    const components = template.components as unknown as TemplateComponents;

    // Extract variables from body
    const bodyVariables = this.extractVariables(components.body.text);

    // Create parameter array indexed by variable number
    const paramArray: (string | number)[] = [];
    if (components.body.variables) {
      components.body.variables.forEach((varName, index) => {
        const value = parameters[varName];
        if (value !== undefined) {
          paramArray[index + 1] = value;
        }
      });
    }

    // Replace placeholders in body text
    let bodyText = components.body.text;
    bodyVariables.forEach((varNum) => {
      const value = paramArray[varNum];
      if (value !== undefined) {
        bodyText = bodyText.replace(`{{${varNum}}}`, String(value));
      }
    });

    // Build preview result
    const preview: PreviewResult = {
      body: bodyText,
    };

    if (components.header?.text) {
      preview.header = components.header.text;
    }

    if (components.footer?.text) {
      preview.footer = components.footer.text;
    }

    if (components.buttons) {
      preview.buttons = components.buttons;
    }

    return preview;
  }

  /**
   * Validate parameters against template
   */
  async validateParameters(
    id: string,
    userId: string,
    parameters: Record<string, string | number>,
  ): Promise<ValidationResult> {
    const template = await this.getTemplateById(id, userId);
    const components = template.components as unknown as TemplateComponents;

    const errors: string[] = [];
    const expectedParams = components.body.variables || [];
    const providedParams = Object.keys(parameters);

    // Check for missing parameters
    expectedParams.forEach((param) => {
      if (parameters[param] === undefined) {
        errors.push(`Missing required parameter: ${param}`);
      }
    });

    // Check for extra parameters
    providedParams.forEach((param) => {
      if (!expectedParams.includes(param)) {
        errors.push(`Unexpected parameter: ${param}`);
      }
    });

    // Check parameter count
    const bodyVariables = this.extractVariables(components.body.text);
    if (expectedParams.length !== bodyVariables.length) {
      errors.push(
        `Expected ${bodyVariables.length} parameters, but template defines ${expectedParams.length}`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      expectedParameters: expectedParams,
      providedParameters: providedParams,
    };
  }

  /**
   * Sync templates from Meta WhatsApp API
   * Fetches approved templates from WhatsApp and updates local database
   */
  async syncTemplatesFromMeta(userId: string, wabaId: string): Promise<{
    synced: number;
    updated: number;
    errors: string[];
  }> {
    try {
      logger.info(`Syncing templates from Meta for user ${userId}, WABA ${wabaId}`);

      // Fetch templates from Meta API
      // Note: This is a placeholder - actual implementation would use the WhatsApp Graph API
      // GET /{waba_id}/message_templates
      const metaTemplates = await this.fetchMetaTemplates(wabaId);

      let synced = 0;
      let updated = 0;
      const errors: string[] = [];

      // Process each Meta template
      await Promise.all(
        metaTemplates.map(async (metaTemplate) => {
          try {
            // Find existing template by name
            const existing = await this.templateRepository.findByName(
              userId,
              metaTemplate.name,
            );

            if (existing) {
              // Update existing template
              const updateData: Prisma.TemplateUpdateInput = {
                whatsappTemplateId: metaTemplate.id,
                language: metaTemplate.language,
                components: metaTemplate.components as Prisma.JsonObject,
              };

              // Map Meta status to our status
              if (metaTemplate.status === 'APPROVED') {
                updateData.status = 'approved';
                updateData.approvedAt = new Date();
                updateData.rejectionReason = null;
              } else if (metaTemplate.status === 'REJECTED') {
                updateData.status = 'rejected';
                updateData.rejectionReason = metaTemplate.rejected_reason || 'Rejected by Meta';
              } else if (metaTemplate.status === 'PENDING') {
                updateData.status = 'pending';
              }

              await this.templateRepository.update(existing.id, updateData);
              updated += 1;
            } else {
              // Create new template from Meta
              const status = this.mapMetaStatus(metaTemplate.status);
              await this.templateRepository.create({
                user: { connect: { id: userId } },
                name: metaTemplate.name,
                whatsappTemplateId: metaTemplate.id,
                language: metaTemplate.language,
                category: metaTemplate.category as TemplateCategory,
                status,
                components: metaTemplate.components as Prisma.JsonObject,
                approvedAt: status === 'approved' ? new Date() : null,
                rejectionReason: metaTemplate.rejected_reason,
              });
              synced += 1;
            }
          } catch (error) {
            const errorMsg = `Failed to sync template ${metaTemplate.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }),
      );

      logger.info(`Template sync completed: ${synced} new, ${updated} updated, ${errors.length} errors`);

      return { synced, updated, errors };
    } catch (error) {
      logger.error('Error syncing templates from Meta:', error);
      throw new WhatsAppError(
        `Failed to sync templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        502,
      );
    }
  }

  /**
   * Fetch templates from Meta WhatsApp API
   * This is a placeholder - actual implementation would use the WhatsApp Graph API
   */
  private async fetchMetaTemplates(wabaId: string): Promise<MetaTemplate[]> {
    // In a real implementation, this would make an API call:
    // GET https://graph.facebook.com/v18.0/{waba_id}/message_templates
    //
    // For now, return empty array as this requires proper Meta API credentials
    // and is typically mocked in tests
    logger.info(`Fetching templates from Meta API for WABA ${wabaId}`);

    // This would be replaced with actual API call
    // const response = await axios.get(
    //   `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
    //   { params: { access_token: this.whatsappConfig.accessToken } }
    // );
    // return response.data.data;

    return [];
  }

  /**
   * Map Meta template status to our status enum
   */
  private mapMetaStatus(metaStatus: string): TemplateStatus {
    switch (metaStatus) {
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      case 'PENDING':
        return 'pending';
      default:
        return 'draft';
    }
  }
}

export default TemplateService;
