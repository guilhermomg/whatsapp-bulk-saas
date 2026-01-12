interface WhatsAppConfig {
  apiVersion: string;
  phoneNumberId?: string; // DEPRECATED: Now per-user
  businessAccountId?: string; // DEPRECATED: Now per-user
  accessToken?: string; // DEPRECATED: Now per-user
  webhookVerifyToken?: string; // DEPRECATED: Now per-user
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
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || undefined,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || undefined,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || undefined,
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
 * NOTE: This is now optional since credentials are stored per-user in the database
 * Only appSecret is required for webhook verification
 * @throws {Error} If any required configuration is missing
 */
export const validateWhatsAppConfig = (): void => {
  const whatsappConfig = getWhatsAppConfig();

  // Only validate app secret (for webhook verification)
  if (!whatsappConfig.appSecret) {
    throw new Error(
      'Missing required WhatsApp configuration: WHATSAPP_APP_SECRET. This is needed for webhook verification.',
    );
  }

  // Warn if legacy env vars are still set
  if (
    whatsappConfig.phoneNumberId
    || whatsappConfig.businessAccountId
    || whatsappConfig.accessToken
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      'WARNING: Global WhatsApp credentials found in environment variables. '
        + 'These are deprecated in multi-tenant mode. '
        + 'Users should connect their own WhatsApp Business Accounts via the API.',
    );
  }
};

export default getWhatsAppConfig;
