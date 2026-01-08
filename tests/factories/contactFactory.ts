import { OptInSource } from '@prisma/client';

let contactCounter = 0;

export interface CreateContactOptions {
  userId: string;
  phone?: string;
  name?: string;
  email?: string;
  optedIn?: boolean;
  optInSource?: OptInSource;
  tags?: string[];
  metadata?: any;
  isBlocked?: boolean;
}

/**
 * Factory for creating test Contact data
 */
export function createContactData(options: CreateContactOptions): any {
  contactCounter++;
  
  return {
    userId: options.userId,
    phone: options.phone || `+141555501${String(contactCounter).padStart(2, '0')}`,
    name: options.name || `Test Contact ${contactCounter}`,
    email: options.email || `contact${contactCounter}@example.com`,
    optedIn: options.optedIn !== undefined ? options.optedIn : true,
    optedInAt: options.optedIn !== false ? new Date() : null,
    optInSource: options.optInSource || 'manual',
    tags: options.tags || ['test'],
    metadata: options.metadata || { source: 'test' },
    isBlocked: options.isBlocked || false,
  };
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetContactCounter(): void {
  contactCounter = 0;
}
