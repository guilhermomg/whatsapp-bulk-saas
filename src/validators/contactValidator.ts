import Joi from 'joi';
import { joiPhoneValidator } from './phoneValidator';

/**
 * Joi schemas for contact validation
 */

// Schema for creating a contact
export const createContactSchema = Joi.object({
  phone: Joi.string()
    .required()
    .custom(joiPhoneValidator)
    .messages({
      'any.required': 'Phone number is required',
      'any.invalid': 'Phone number must be in E.164 format (e.g., +14155552671)',
    }),
  name: Joi.string().min(1).max(255).optional()
    .allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  tags: Joi.array().items(Joi.string().min(1).max(50)).optional().default([]),
  metadata: Joi.object().optional().allow(null),
  optedIn: Joi.boolean().optional().default(false),
  optInSource: Joi.string().valid('manual', 'csv', 'api', 'webhook').optional().allow(null),
  userId: Joi.string().uuid().required(),
});

// Schema for updating a contact
export const updateContactSchema = Joi.object({
  phone: Joi.string().custom(joiPhoneValidator).optional().messages({
    'any.invalid': 'Phone number must be in E.164 format (e.g., +14155552671)',
  }),
  name: Joi.string().min(1).max(255).optional()
    .allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  tags: Joi.array().items(Joi.string().min(1).max(50)).optional(),
  metadata: Joi.object().optional().allow(null),
}).min(1); // At least one field must be provided

// Schema for listing contacts with filters
export const listContactsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100)
    .optional()
    .default(30),
  offset: Joi.number().integer().min(0).optional()
    .default(0),
  search: Joi.string().min(1).max(255).optional(),
  optedIn: Joi.boolean().optional(),
  tags: Joi.alternatives()
    .try(
      Joi.string().min(1), // Single tag as string
      Joi.array().items(Joi.string().min(1)), // Multiple tags as array
    )
    .optional(),
  isBlocked: Joi.boolean().optional(),
  sortBy: Joi.string().valid('createdAt', 'name', 'phone', 'updatedAt').optional().default('createdAt'),
  order: Joi.string().valid('asc', 'desc').optional().default('desc'),
  createdAfter: Joi.date().iso().optional(),
  createdBefore: Joi.date().iso().optional(),
});

// Schema for CSV import validation
export const importCsvSchema = Joi.object({
  file: Joi.any().required().messages({
    'any.required': 'CSV file is required',
  }),
});

// Schema for bulk opt-in
export const bulkOptInSchema = Joi.object({
  contactIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one contact ID is required',
      'array.max': 'Maximum 1000 contacts can be updated at once',
      'any.required': 'Contact IDs array is required',
    }),
  optInSource: Joi.string().valid('manual', 'csv', 'api', 'webhook').optional().default('api'),
});

// Schema for bulk opt-out
export const bulkOptOutSchema = Joi.object({
  contactIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one contact ID is required',
      'array.max': 'Maximum 1000 contacts can be updated at once',
      'any.required': 'Contact IDs array is required',
    }),
  reason: Joi.string().max(500).optional().allow(null, ''),
});

// Schema for opt-in single contact
export const optInSchema = Joi.object({
  optInSource: Joi.string().valid('manual', 'csv', 'api', 'webhook').optional().default('manual'),
});

// Schema for opt-out single contact
export const optOutSchema = Joi.object({
  reason: Joi.string().max(500).optional().allow(null, ''),
});

// Schema for tag operations
export const updateTagsSchema = Joi.object({
  action: Joi.string().valid('add', 'remove', 'set').required().messages({
    'any.required': 'Action is required (add, remove, or set)',
    'any.only': 'Action must be one of: add, remove, or set',
  }),
  tags: Joi.array()
    .items(Joi.string().min(1).max(50))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one tag is required',
      'any.required': 'Tags array is required',
    }),
});

// Schema for bulk tag operations
export const bulkTagSchema = Joi.object({
  contactIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one contact ID is required',
      'array.max': 'Maximum 1000 contacts can be updated at once',
      'any.required': 'Contact IDs array is required',
    }),
  tags: Joi.array()
    .items(Joi.string().min(1).max(50))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one tag is required',
      'any.required': 'Tags array is required',
    }),
});

// Schema for CSV row validation during import
export const csvRowSchema = Joi.object({
  phone: Joi.string().required().custom(joiPhoneValidator).messages({
    'any.required': 'Phone number is required',
    'any.invalid': 'Phone number must be in E.164 format (e.g., +14155552671)',
  }),
  name: Joi.string().min(1).max(255).optional()
    .allow(null, ''),
  email: Joi.string().email().optional().allow(null, ''),
  tags: Joi.alternatives()
    .try(
      Joi.string().min(1), // Single tag or comma-separated tags
      Joi.array().items(Joi.string().min(1)),
    )
    .optional(),
  opt_in_source: Joi.string().valid('manual', 'csv', 'api', 'webhook').optional(),
});

/**
 * Validate request body against a Joi schema
 * @param schema - Joi schema to validate against
 * @param data - Data to validate
 * @returns Validated data or throws ValidationError
 */
export function validateSchema<T>(schema: Joi.ObjectSchema, data: any): T {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const errorMessage = error.details.map((detail) => detail.message).join(', ');
    throw new Error(errorMessage);
  }

  return value;
}
