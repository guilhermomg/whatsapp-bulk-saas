/* eslint-disable @typescript-eslint/no-unused-vars */
import WhatsAppClient from '../../src/services/whatsapp/whatsappClient';

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

/**
 * Mock WhatsApp Client for testing
 */
class MockWhatsAppClient {
  private shouldFail: boolean = false;

  private failureError: Error | null = null;

  /**
   * Configure mock to fail with specific error
   */
  setFailure(error: Error): void {
    this.shouldFail = true;
    this.failureError = error;
  }

  /**
   * Reset mock to success mode
   */
  resetMock(): void {
    this.shouldFail = false;
    this.failureError = null;
  }

  async sendTextMessage(params: {
    to: string;
    body: string;
    previewUrl?: boolean;
  }): Promise<MessageResponse> {
    if (this.shouldFail && this.failureError) {
      throw this.failureError;
    }

    return {
      messaging_product: 'whatsapp',
      contacts: [
        {
          input: params.to,
          wa_id: params.to.replace('+', ''),
        },
      ],
      messages: [
        {
          id: `msg_mock_${Date.now()}`,
        },
      ],
    };
  }

  async sendTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode: string;
    components?: unknown[];
  }): Promise<MessageResponse> {
    if (this.shouldFail && this.failureError) {
      throw this.failureError;
    }

    return {
      messaging_product: 'whatsapp',
      contacts: [
        {
          input: params.to,
          wa_id: params.to.replace('+', ''),
        },
      ],
      messages: [
        {
          id: `msg_template_mock_${Date.now()}`,
        },
      ],
    };
  }

  async getPhoneNumberInfo(): Promise<PhoneNumberInfo> {
    if (this.shouldFail && this.failureError) {
      throw this.failureError;
    }

    return {
      verified_name: 'Test Business',
      display_phone_number: '+1 555-0100',
      quality_rating: 'GREEN',
      id: 'mock_phone_number_id',
    };
  }

  async getBusinessProfile(): Promise<BusinessProfile> {
    if (this.shouldFail && this.failureError) {
      throw this.failureError;
    }

    return {
      about: 'Test Business Description',
      address: '123 Test Street',
      description: 'A test business',
      email: 'test@business.com',
      messaging_product: 'whatsapp',
    };
  }

  async checkConnectivity(): Promise<boolean> {
    if (this.shouldFail) {
      return false;
    }
    return true;
  }
}

export default MockWhatsAppClient;
