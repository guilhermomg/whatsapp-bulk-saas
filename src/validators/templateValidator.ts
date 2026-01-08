import Joi from 'joi';

/**
 * Joi schemas for template validation
 */

// Valid language codes (ISO 639-1 with locale)
const languageCodes = [
  'en_US', 'en_GB', 'es_ES', 'es_MX', 'pt_BR', 'pt_PT',
  'fr_FR', 'de_DE', 'it_IT', 'nl_NL', 'ru_RU', 'ar_AR',
  'hi_IN', 'id_ID', 'ja_JP', 'ko_KR', 'zh_CN', 'zh_TW',
];

// Template component schemas
const headerComponentSchema = Joi.object({
  type: Joi.string().valid('text', 'image', 'video', 'document').required(),
  text: Joi.when('type', {
    is: 'text',
    then: Joi.string().max(60).required(),
    otherwise: Joi.forbidden(),
  }),
  url: Joi.when('type', {
    is: Joi.string().valid('image', 'video', 'document'),
    then: Joi.string().uri().optional(),
    otherwise: Joi.forbidden(),
  }),
});

const bodyComponentSchema = Joi.object({
  text: Joi.string().max(1024).required(),
  variables: Joi.array().items(Joi.string().min(1).max(100)).optional().default([]),
});

const footerComponentSchema = Joi.object({
  text: Joi.string().max(60).required(),
});

const buttonComponentSchema = Joi.object({
  type: Joi.string().valid('url', 'phone', 'quick_reply').required(),
  text: Joi.string().max(25).required(),
  url: Joi.when('type', {
    is: 'url',
    then: Joi.string().uri().required(),
    otherwise: Joi.forbidden(),
  }),
  phone_number: Joi.when('type', {
    is: 'phone',
    then: Joi.string().required(),
    otherwise: Joi.forbidden(),
  }),
});

const componentsSchema = Joi.object({
  header: headerComponentSchema.optional(),
  body: bodyComponentSchema.required(),
  footer: footerComponentSchema.optional(),
  buttons: Joi.array().items(buttonComponentSchema).max(3).optional(),
});

// Schema for creating a template
export const createTemplateSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  name: Joi.string()
    .pattern(/^[a-z0-9_]+$/)
    .min(1)
    .max(512)
    .required()
    .messages({
      'string.pattern.base': 'Template name must contain only lowercase letters, numbers, and underscores',
      'any.required': 'Template name is required',
    }),
  language: Joi.string()
    .valid(...languageCodes)
    .optional()
    .default('en_US')
    .messages({
      'any.only': `Language must be one of: ${languageCodes.join(', ')}`,
    }),
  category: Joi.string()
    .valid('marketing', 'utility', 'authentication')
    .required()
    .messages({
      'any.required': 'Template category is required',
      'any.only': 'Category must be one of: marketing, utility, authentication',
    }),
  components: componentsSchema.required(),
});

// Schema for updating a template
export const updateTemplateSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[a-z0-9_]+$/)
    .min(1)
    .max(512)
    .optional()
    .messages({
      'string.pattern.base': 'Template name must contain only lowercase letters, numbers, and underscores',
    }),
  language: Joi.string()
    .valid(...languageCodes)
    .optional()
    .messages({
      'any.only': `Language must be one of: ${languageCodes.join(', ')}`,
    }),
  category: Joi.string()
    .valid('marketing', 'utility', 'authentication')
    .optional()
    .messages({
      'any.only': 'Category must be one of: marketing, utility, authentication',
    }),
  components: componentsSchema.optional(),
}).min(1); // At least one field must be provided

// Schema for listing templates
export const listTemplatesSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  limit: Joi.number().integer().min(1).max(100)
    .optional()
    .default(30),
  offset: Joi.number().integer().min(0).optional()
    .default(0),
  status: Joi.string()
    .valid('draft', 'pending', 'approved', 'rejected')
    .optional(),
  category: Joi.string()
    .valid('marketing', 'utility', 'authentication')
    .optional(),
  search: Joi.string().min(1).max(255).optional(),
  sortBy: Joi.string()
    .valid('createdAt', 'updatedAt', 'name', 'status')
    .optional()
    .default('createdAt'),
  order: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .default('desc'),
});

// Schema for template preview
export const previewTemplateSchema = Joi.object({
  parameters: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number()),
  ).optional().default({}),
});

// Schema for parameter validation
export const validateParametersSchema = Joi.object({
  parameters: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number()),
  ).required(),
});
