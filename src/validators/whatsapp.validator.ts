import Joi from 'joi';

/**
 * Schema for connecting WhatsApp Business Account
 */
export const connectWhatsAppSchema = Joi.object({
  wabaId: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.empty': 'WhatsApp Business Account ID is required',
      'any.required': 'WhatsApp Business Account ID is required',
    }),
  phoneNumberId: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.empty': 'Phone Number ID is required',
      'any.required': 'Phone Number ID is required',
    }),
  accessToken: Joi.string()
    .min(20)
    .required()
    .messages({
      'string.empty': 'Access Token is required',
      'string.min': 'Access Token is invalid',
      'any.required': 'Access Token is required',
    }),
});

export const sendTextMessageSchema = Joi.object({
  type: Joi.string().valid('text').required(),
  to: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in E.164 format (e.g., +14155238886)',
      'any.required': 'Recipient phone number is required',
    }),
  body: Joi.string()
    .min(1)
    .max(4096)
    .required()
    .messages({
      'string.min': 'Message body cannot be empty',
      'string.max': 'Message body cannot exceed 4096 characters',
      'any.required': 'Message body is required',
    }),
  previewUrl: Joi.boolean().optional(),
});

export const sendTemplateMessageSchema = Joi.object({
  type: Joi.string().valid('template').required(),
  to: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in E.164 format (e.g., +14155238886)',
      'any.required': 'Recipient phone number is required',
    }),
  templateName: Joi.string().required().messages({
    'any.required': 'Template name is required',
  }),
  languageCode: Joi.string()
    .pattern(/^[a-z]{2}_[A-Z]{2}$/)
    .required()
    .messages({
      'string.pattern.base': 'Language code must be in format like en_US, pt_BR, etc.',
      'any.required': 'Language code is required',
    }),
  components: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid('header', 'body', 'button').required(),
        parameters: Joi.array().items(
          Joi.object({
            type: Joi.string().required(),
            text: Joi.string().optional(),
          }),
        ),
      }),
    )
    .optional(),
});

export const webhookVerificationSchema = Joi.object({
  'hub.mode': Joi.string().valid('subscribe').required(),
  'hub.verify_token': Joi.string().required(),
  'hub.challenge': Joi.string().required(),
});

export const webhookEventSchema = Joi.object({
  object: Joi.string().valid('whatsapp_business_account').required(),
  entry: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        changes: Joi.array()
          .items(
            Joi.object({
              value: Joi.object({
                messaging_product: Joi.string().valid('whatsapp').required(),
                metadata: Joi.object({
                  display_phone_number: Joi.string().required(),
                  phone_number_id: Joi.string().required(),
                }).required(),
                contacts: Joi.array()
                  .items(
                    Joi.object({
                      profile: Joi.object({
                        name: Joi.string().required(),
                      }).required(),
                      wa_id: Joi.string().required(),
                    }),
                  )
                  .optional(),
                messages: Joi.array()
                  .items(
                    Joi.object({
                      from: Joi.string().required(),
                      id: Joi.string().required(),
                      timestamp: Joi.string().required(),
                      type: Joi.string().required(),
                      text: Joi.object({
                        body: Joi.string().required(),
                      }).optional(),
                    }),
                  )
                  .optional(),
                statuses: Joi.array()
                  .items(
                    Joi.object({
                      id: Joi.string().required(),
                      status: Joi.string()
                        .valid('sent', 'delivered', 'read', 'failed')
                        .required(),
                      timestamp: Joi.string().required(),
                      recipient_id: Joi.string().required(),
                      conversation: Joi.object().optional(),
                      pricing: Joi.object().optional(),
                      errors: Joi.array().optional(),
                    }),
                  )
                  .optional(),
              }).required(),
              field: Joi.string().valid('messages').required(),
            }),
          )
          .required(),
      }),
    )
    .required(),
});
