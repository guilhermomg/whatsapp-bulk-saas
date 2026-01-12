interface WhatsAppConfig {
  apiVersion: string;
  appSecret: string;
  webhookVerifyToken: string;
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
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
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
 * Only appSecret and webhookVerifyToken are required for webhook handling
 * @throws {Error} If any required configuration is missing
 */
export const validateWhatsAppConfig = (): void => {
  const whatsappConfig = getWhatsAppConfig();

  const missingFields = [];
  if (!whatsappConfig.appSecret) {
    missingFields.push('WHATSAPP_APP_SECRET');
  }
  if (!whatsappConfig.webhookVerifyToken) {
    missingFields.push('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
  }

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required WhatsApp configuration: ${missingFields.join(', ')}. These are needed for webhook handling.`,
    );
  }
};

export default getWhatsAppConfig;
