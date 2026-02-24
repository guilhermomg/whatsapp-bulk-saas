let userCounter = 0;

// Pre-hashed password for "TestPassword123!" to avoid hashing in every test
const TEST_HASHED_PASSWORD = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWO';

export interface CreateUserOptions {
  email?: string;
  password?: string;
  businessName?: string;
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  subscriptionTier?: 'free' | 'basic' | 'pro';
  isActive?: boolean;
  emailVerified?: boolean;
}

/**
 * Factory for creating test User data
 */
export function createUserData(options: CreateUserOptions = {}): any {
  userCounter += 1;

  return {
    email: options.email || `test${userCounter}@example.com`,
    password: options.password || TEST_HASHED_PASSWORD,
    businessName: options.businessName || `Test Business ${userCounter}`,
    wabaId: options.wabaId || `waba_${userCounter}`,
    phoneNumberId: options.phoneNumberId || `phone_${userCounter}`,
    accessToken: options.accessToken || `test_token_${userCounter}`,
    webhookVerifyToken: options.webhookVerifyToken || `webhook_token_${userCounter}`,
    subscriptionTier: options.subscriptionTier || 'free',
    isActive: options.isActive !== undefined ? options.isActive : true,
    emailVerified: options.emailVerified !== undefined ? options.emailVerified : true,
  };
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetUserCounter(): void {
  userCounter = 0;
}
