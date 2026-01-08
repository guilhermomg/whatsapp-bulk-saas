import { TemplateCategory, TemplateStatus } from '@prisma/client';

let templateCounter = 0;

export interface CreateTemplateOptions {
  userId: string;
  name?: string;
  category?: TemplateCategory;
  status?: TemplateStatus;
  components?: any;
}

/**
 * Factory for creating test Template data
 */
export function createTemplateData(options: CreateTemplateOptions): any {
  templateCounter++;
  
  return {
    userId: options.userId,
    name: options.name || `test_template_${templateCounter}`,
    whatsappTemplateId: `wa_template_${templateCounter}`,
    language: 'en_US',
    category: options.category || 'marketing',
    status: options.status || 'approved',
    components: options.components || {
      header: { type: 'text', text: 'Test Header' },
      body: { type: 'text', text: 'Test message body {{1}}' },
      footer: { type: 'text', text: 'Reply STOP to unsubscribe' },
    },
    approvedAt: options.status === 'approved' ? new Date() : null,
  };
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetTemplateCounter(): void {
  templateCounter = 0;
}
