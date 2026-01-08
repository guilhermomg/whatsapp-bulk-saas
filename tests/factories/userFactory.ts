import { User, SubscriptionTier } from '@prisma/client';
import { encrypt } from '../../src/utils/encryption';

let userCounter = 0;

export interface CreateUserOptions {
  email?: string;
  businessName?: string;
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  subscriptionTier?: SubscriptionTier;
  isActive?: boolean;
}

/**
 * Factory for creating test User data
 */
export function createUserData(options: CreateUserOptions = {}): any {
  userCounter++;
  
  return {
    email: options.email || `test${userCounter}@example.com`,
    businessName: options.businessName || `Test Business ${userCounter}`,
    wabaId: options.wabaId || `waba_${userCounter}`,
    phoneNumberId: options.phoneNumberId || `phone_${userCounter}`,
    accessToken: options.accessToken 
      ? encrypt(options.accessToken) 
      : encrypt(`test_token_${userCounter}`),
    webhookVerifyToken: options.webhookVerifyToken 
      ? encrypt(options.webhookVerifyToken) 
      : encrypt(`webhook_token_${userCounter}`),
    subscriptionTier: options.subscriptionTier || 'free',
    isActive: options.isActive !== undefined ? options.isActive : true,
  };
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetUserCounter(): void {
  userCounter = 0;
}
