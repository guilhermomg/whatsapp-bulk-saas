import { MessageDirection, MessageContentType, MessageStatus } from '@prisma/client';

let messageCounter = 0;

export interface CreateMessageOptions {
  userId: string;
  contactId: string;
  campaignId?: string;
  direction?: MessageDirection;
  type?: MessageContentType;
  content?: any;
  status?: MessageStatus;
}

/**
 * Factory for creating test Message data
 */
export function createMessageData(options: CreateMessageOptions): any {
  messageCounter++;
  
  return {
    userId: options.userId,
    contactId: options.contactId,
    campaignId: options.campaignId || null,
    whatsappMessageId: `wamid_test_${messageCounter}`,
    direction: options.direction || 'outbound',
    type: options.type || 'text',
    content: options.content || { text: 'Test message' },
    status: options.status || 'queued',
    retryCount: 0,
  };
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetMessageCounter(): void {
  messageCounter = 0;
}
