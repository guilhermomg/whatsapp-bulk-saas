import { CampaignStatus, MessageType } from '@prisma/client';

let campaignCounter = 0;

export interface CreateCampaignOptions {
  userId: string;
  name?: string;
  templateId?: string;
  messageType?: MessageType;
  messageContent?: any;
  status?: CampaignStatus;
  totalRecipients?: number;
}

/**
 * Factory for creating test Campaign data
 */
export function createCampaignData(options: CreateCampaignOptions): any {
  campaignCounter++;
  
  return {
    userId: options.userId,
    name: options.name || `Test Campaign ${campaignCounter}`,
    templateId: options.templateId || null,
    messageType: options.messageType || 'text',
    messageContent: options.messageContent || {
      text: 'Test message content',
    },
    status: options.status || 'draft',
    totalRecipients: options.totalRecipients || 0,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    readCount: 0,
  };
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetCampaignCounter(): void {
  campaignCounter = 0;
}
