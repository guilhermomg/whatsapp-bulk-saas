import axios, { AxiosError } from 'axios';
import { Template, TemplateStatus } from '@prisma/client';
import { TemplateRepository } from '../repositories/templateRepository';
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

interface WhatsAppTemplatePayload {
  name: string;
  category: string;
  language?: string;
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: Record<string, any>;
    buttons?: Array<any>;
  }>;
}

interface WhatsAppSubmitResponse {
  id: string;
  status: string;
  category?: string;
  [key: string]: any;
}

interface WhatsAppStatusUpdate {
  whatsappTemplateId: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  rejectionReason?: string;
}

/**
 * WhatsApp Template Service
 * Handles integration with Meta WhatsApp Cloud API for template management
 */
export class WhatsAppTemplateService {
  private apiVersion: string;

  private baseUrl: string;

  private timeout: number;

  private retryAttempts: number;

  private retryDelays: number[];

  private templateRepository: TemplateRepository;

  constructor(templateRepository?: TemplateRepository) {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.timeout = 30000;
    this.retryAttempts = 5;
    this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
    this.templateRepository = templateRepository || new TemplateRepository();
  }

  /**
   * Transform local template format to WhatsApp API format
   */
  private transformToWhatsAppFormat(template: Template): WhatsAppTemplatePayload {
    const components = template.components as unknown as TemplateComponents;
    const payload: WhatsAppTemplatePayload = {
      name: template.name,
      category: template.category.toUpperCase(),
      language: template.language,
      components: [],
    };

    // Add header component if present
    if (components.header?.text) {
      payload.components.push({
        type: 'HEADER',
        format: (components.header.type || 'TEXT').toUpperCase() as any,
        text: components.header.type === 'text' ? components.header.text : undefined,
        example: components.header.type !== 'text' ? { header_url: [components.header.url] } : undefined,
      });
    }

    // Add body component (required)
    const bodyComponent: any = {
      type: 'BODY',
      text: components.body.text,
    };

    // Add example parameters if variables exist
    if (components.body.variables && components.body.variables.length > 0) {
      bodyComponent.example = {
        body_text: [components.body.variables], // WhatsApp expects array of parameter values
      };
    }

    payload.components.push(bodyComponent);

    // Add footer component if present
    if (components.footer?.text) {
      payload.components.push({
        type: 'FOOTER',
        text: components.footer.text,
      });
    }

    // Add buttons component if present
    if (components.buttons && components.buttons.length > 0) {
      const buttons = components.buttons.map((btn) => {
        const whatsappBtn: any = {
          type: btn.type.toUpperCase(),
          text: btn.text,
        };

        if (btn.type === 'url' && btn.url) {
          whatsappBtn.url = btn.url;
        } else if (btn.type === 'phone' && btn.phone_number) {
          whatsappBtn.phone_number = btn.phone_number;
        }

        return whatsappBtn;
      });

      payload.components.push({
        type: 'BUTTONS',
        buttons,
      });
    }

    return payload;
  }

  /**
   * Submit template to WhatsApp for approval with retry logic
   */
  async submitTemplate(
    template: Template,
    wabaId: string,
    accessToken: string,
  ): Promise<{ success: boolean; whatsappTemplateId?: string; error?: string }> {
    try {
      logger.info(`Submitting template ${template.id} (${template.name}) to WhatsApp WABA ${wabaId}`);

      const payload = this.transformToWhatsAppFormat(template);

      let lastError: any;
      let response: WhatsAppSubmitResponse | null = null;

      // Retry logic with exponential backoff
      for (let attempt = 0; attempt <= this.retryAttempts; attempt += 1) {
        try {
          const result = await this.submitWithRetry(wabaId, accessToken, payload);
          response = result;
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          const axiosError = error as AxiosError;
          const statusCode = axiosError.response?.status || 0;

          // Determine if error is retryable
          const isRetryable = this.isRetryableError(statusCode);

          if (isRetryable && attempt < this.retryAttempts) {
            const delayMs = this.retryDelays[attempt];
            logger.warn(
              `Template submission failed (attempt ${attempt + 1}/${this.retryAttempts + 1}). Retrying in ${delayMs}ms...`,
              { templateId: template.id, error: axiosError.message },
            );
            await this.sleep(delayMs);
          } else {
            throw error; // Non-retryable or max retries reached
          }
        }
      }

      if (!response) {
        throw lastError;
      }

      // Update template with WhatsApp template ID and status
      await this.templateRepository.update(template.id, {
        whatsappTemplateId: response.id,
        status: 'pending',
      });

      logger.info(
        `Template ${template.name} successfully submitted to WhatsApp. ID: ${response.id}`,
      );

      return {
        success: true,
        whatsappTemplateId: response.id,
      };
    } catch (error) {
      logger.error(`Failed to submit template ${template.id}:`, error);

      const errorMessage = this.formatErrorMessage(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Make actual HTTP request to WhatsApp API
   */
  private async submitWithRetry(
    wabaId: string,
    accessToken: string,
    payload: WhatsAppTemplatePayload,
  ): Promise<WhatsAppSubmitResponse> {
    const url = `${this.baseUrl}/${wabaId}/message_templates`;

    try {
      const response = await axios.post<WhatsAppSubmitResponse>(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: this.timeout,
        params: {
          access_token: accessToken,
        },
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error('WhatsApp API Request Failed:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
      throw error;
    }
  }

  /**
   * Handle webhook notification for template status updates
   */
  async handleTemplateStatusUpdate(
    update: WhatsAppStatusUpdate,
  ): Promise<void> {
    try {
      logger.info(
        `Processing template status update: ID ${update.whatsappTemplateId} → ${update.status}`,
      );

      // Find template by WhatsApp template ID
      const template = await this.templateRepository.findByWhatsAppId(
        update.whatsappTemplateId,
      );

      if (!template) {
        logger.warn(`Template not found for WhatsApp ID: ${update.whatsappTemplateId}`);
        return;
      }

      // Map WhatsApp status to our status enum
      const newStatus = this.mapWhatsAppStatus(update.status) as TemplateStatus;
      const updateData: any = { status: newStatus };

      // Add metadata based on status
      if (newStatus === 'approved') {
        updateData.approvedAt = new Date();
        updateData.rejectionReason = null;
      } else if (newStatus === 'rejected') {
        updateData.rejectionReason = update.rejectionReason || 'Rejected by WhatsApp';
      }

      // Update template
      await this.templateRepository.update(template.id, updateData);

      logger.info(`Template ${template.name} status updated to ${newStatus}`);

      // TODO: Emit event for real-time frontend notification
      // Example: eventEmitter.emit('template:status-updated', { templateId: template.id, newStatus });
    } catch (error) {
      logger.error('Error handling template status update:', error);
      throw error;
    }
  }

  /**
   * Check if error is retryable based on HTTP status code
   */
  private isRetryableError(statusCode: number): boolean {
    // Retry on rate limit (429), server errors (5xx), and timeouts
    if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
      return true;
    }

    // Don't retry on client errors (4xx) except rate limiting
    return false;
  }

  /**
   * Map WhatsApp status to our internal status enum
   */
  private mapWhatsAppStatus(status: string): string {
    const statusMap: Record<string, string> = {
      APPROVED: 'approved',
      REJECTED: 'rejected',
      PENDING: 'pending',
      PAUSED: 'draft', // Paused templates treated as draft
    };

    return statusMap[status] || 'pending';
  }

  /**
   * Format error message from API response
   */
  private formatErrorMessage(error: any): string {
    try {
      if (error instanceof Error) {
        const axiosError = error as AxiosError;

        // Try to extract WhatsApp error message
        if (axiosError.response?.data) {
          const data = axiosError.response.data as any;
          if (data.error?.message) {
            return data.error.message;
          }
          if (data.message) {
            return data.message;
          }
        }

        return axiosError.message;
      }

      return String(error);
    } catch {
      return 'Unknown error during template submission';
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default WhatsAppTemplateService;
