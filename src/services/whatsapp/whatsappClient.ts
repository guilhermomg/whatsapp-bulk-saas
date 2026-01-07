import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../../config/logger';
import whatsappConfig from '../../config/whatsapp';
import {
  WhatsAppError,
  WhatsAppAuthError,
  WhatsAppRateLimitError,
  WhatsAppTemplateError,
  WhatsAppInvalidRecipientError,
} from '../../utils/errors';

interface MessageResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

interface PhoneNumberInfo {
  verified_name: string;
  display_phone_number: string;
  quality_rating: string;
  id: string;
}

interface BusinessProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  profile_picture_url?: string;
  websites?: string[];
  vertical?: string;
  messaging_product: string;
}

interface TemplateComponent {
  type: string;
  parameters?: Array<{
    type: string;
    text?: string;
  }>;
}

interface SendTextMessageParams {
  to: string;
  body: string;
  previewUrl?: boolean;
}

interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
}

class WhatsAppClient {
  private client: AxiosInstance;

  private phoneNumberId: string;

  constructor() {
    this.phoneNumberId = whatsappConfig.phoneNumberId;

    this.client = axios.create({
      baseURL: whatsappConfig.baseUrl,
      timeout: whatsappConfig.timeout,
      headers: {
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        const sanitizedConfig = { ...config };
        // Sanitize sensitive data from logs
        if (sanitizedConfig.headers?.Authorization) {
          sanitizedConfig.headers.Authorization = 'Bearer [REDACTED]';
        }

        logger.info('WhatsApp API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: this.sanitizeLogData(config.data),
        });

        return config;
      },
      (error) => {
        logger.error('WhatsApp API Request Error', { error: error.message });
        return Promise.reject(error);
      },
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('WhatsApp API Response', {
          status: response.status,
          data: this.sanitizeLogData(response.data),
        });
        return response;
      },
      (error) => {
        this.logError(error);
        return Promise.reject(this.handleError(error));
      },
    );
  }

  /**
   * Sanitize sensitive data from logs (phone numbers, tokens, etc.)
   */
  private sanitizeLogData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data } as Record<string, unknown>;

    // Sanitize phone numbers
    if (sanitized.to) {
      sanitized.to = this.maskPhoneNumber(String(sanitized.to));
    }
    if (sanitized.contacts && Array.isArray(sanitized.contacts)) {
      sanitized.contacts = sanitized.contacts.map((contact: { wa_id?: string }) => ({
        ...contact,
        wa_id: contact.wa_id ? this.maskPhoneNumber(contact.wa_id) : contact.wa_id,
      }));
    }

    return sanitized;
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return '****';
    return `****${phone.slice(-4)}`;
  }

  private logError(error: AxiosError): void {
    if (error.response) {
      logger.error('WhatsApp API Error Response', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      logger.error('WhatsApp API No Response', {
        request: error.request,
      });
    } else {
      logger.error('WhatsApp API Request Setup Error', {
        message: error.message,
      });
    }
  }

  private handleError(error: AxiosError): WhatsAppError {
    if (!error.response) {
      return new WhatsAppError('Network error or timeout', 503);
    }

    const { status, data } = error.response;
    const errorData = data as {
      error?: {
        message?: string;
        code?: number;
        error_subcode?: number;
        type?: string;
      };
    };
    const errorMessage = errorData.error?.message || 'Unknown WhatsApp API error';
    const errorCode = errorData.error?.code?.toString();

    // Map WhatsApp error codes to custom errors
    switch (status) {
      case 401:
      case 403:
        return new WhatsAppAuthError(errorMessage, errorCode);
      case 429:
        return new WhatsAppRateLimitError(errorMessage, errorCode);
      case 400:
        if (errorMessage.includes('template') || errorMessage.includes('Template')) {
          return new WhatsAppTemplateError(errorMessage, errorCode);
        }
        if (errorMessage.includes('recipient') || errorMessage.includes('phone')) {
          return new WhatsAppInvalidRecipientError(errorMessage, errorCode);
        }
        return new WhatsAppError(errorMessage, 400, errorCode, errorData);
      default:
        return new WhatsAppError(errorMessage, status, errorCode, errorData);
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    attempt: number = 0,
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      // Don't retry on authentication errors or invalid recipient errors
      if (
        error instanceof WhatsAppAuthError ||
        error instanceof WhatsAppInvalidRecipientError ||
        error instanceof WhatsAppTemplateError
      ) {
        throw error;
      }

      // Retry on rate limit or network errors
      if (attempt < whatsappConfig.retryAttempts - 1) {
        const delay = whatsappConfig.retryDelays[attempt];
        logger.warn(`Retrying WhatsApp API request in ${delay}ms (attempt ${attempt + 1})`, {
          error: error instanceof Error ? error.message : String(error),
        });

        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        return this.retryRequest(requestFn, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Validate phone number format (E.164)
   */
  private validatePhoneNumber(phoneNumber: string): void {
    const e164Regex = /^\+?[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      throw new WhatsAppInvalidRecipientError(
        `Invalid phone number format. Must be in E.164 format (e.g., +14155238886). Got: ${phoneNumber}`,
      );
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(params: SendTextMessageParams): Promise<MessageResponse> {
    this.validatePhoneNumber(params.to);

    return this.retryRequest(async () => {
      const response = await this.client.post<MessageResponse>(
        `/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.to,
          type: 'text',
          text: {
            preview_url: params.previewUrl ?? false,
            body: params.body,
          },
        },
      );
      return response.data;
    });
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(params: SendTemplateMessageParams): Promise<MessageResponse> {
    this.validatePhoneNumber(params.to);

    return this.retryRequest(async () => {
      const response = await this.client.post<MessageResponse>(
        `/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: params.to,
          type: 'template',
          template: {
            name: params.templateName,
            language: {
              code: params.languageCode,
            },
            components: params.components || [],
          },
        },
      );
      return response.data;
    });
  }

  /**
   * Get phone number information
   */
  async getPhoneNumberInfo(): Promise<PhoneNumberInfo> {
    return this.retryRequest(async () => {
      const response = await this.client.get<PhoneNumberInfo>(`/${this.phoneNumberId}`, {
        params: {
          fields: 'verified_name,display_phone_number,quality_rating',
        },
      });
      return response.data;
    });
  }

  /**
   * Get business profile information
   */
  async getBusinessProfile(): Promise<BusinessProfile> {
    return this.retryRequest(async () => {
      const response = await this.client.get<{ data: BusinessProfile[] }>(
        `/${this.phoneNumberId}/whatsapp_business_profile`,
        {
          params: {
            fields: 'about,address,description,email,profile_picture_url,websites,vertical',
          },
        },
      );
      return response.data.data[0];
    });
  }

  /**
   * Check API connectivity and credentials
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      await this.getPhoneNumberInfo();
      return true;
    } catch (error) {
      logger.error('WhatsApp connectivity check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

export default WhatsAppClient;
