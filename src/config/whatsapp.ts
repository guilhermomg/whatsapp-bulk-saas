interface WhatsAppConfig {
  apiVersion: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  appSecret: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelays: number[];
  rateLimit: {
    requestsPerSecond: number;
  };
}

let cachedConfig: WhatsAppConfig | null = null;

const getWhatsAppConfig = (): WhatsAppConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    baseUrl: `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v18.0'}`,
    timeout: 30000, // 30 seconds
    retryAttempts: 5,
    retryDelays: [1000, 2000, 4000, 8000, 16000], // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    rateLimit: {
      requestsPerSecond: 80, // WhatsApp rate limit: 80 requests/second per phone number
    },
  };

  return cachedConfig;
};

/**
 * Validates that all required WhatsApp configuration variables are set
 * @throws {Error} If any required configuration is missing
 */
export const validateWhatsAppConfig = (): void => {
  const whatsappConfig = getWhatsAppConfig();
  const requiredFields = [
    'phoneNumberId',
    'businessAccountId',
    'accessToken',
    'webhookVerifyToken',
    'appSecret',
  ];

  const missingFields = requiredFields.filter(
    (field) => !whatsappConfig[field as keyof WhatsAppConfig],
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required WhatsApp configuration: ${missingFields.join(', ')}. Please check your .env file.`,
    );
  }
};

export default getWhatsAppConfig;
