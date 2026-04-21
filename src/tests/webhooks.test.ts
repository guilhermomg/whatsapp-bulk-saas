import request from 'supertest';
import app from '../app';
import messageRepo from '../repositories/messageRepository';
import campaignRepo from '../repositories/campaignRepository';
import webhookEventRepo from '../repositories/webhookEventRepository';

jest.mock('../repositories/messageRepository', () => ({
  __esModule: true,
  default: { updateStatusByWhatsAppMessageId: jest.fn() },
  MessageRepository: jest.fn(),
}));

jest.mock('../repositories/campaignRepository', () => ({
  __esModule: true,
  default: {
    incrementDeliveredCount: jest.fn(),
    incrementReadCount: jest.fn(),
    incrementFailedCount: jest.fn(),
  },
  CampaignRepository: jest.fn(),
}));

jest.mock('../repositories/webhookEventRepository', () => ({
  __esModule: true,
  default: {
    findByExternalId: jest.fn(),
    create: jest.fn(),
    markAsProcessed: jest.fn(),
    markAsFailed: jest.fn(),
  },
  WebhookEventRepository: jest.fn(),
}));

jest.mock('../utils/webhookUtils', () => ({
  __esModule: true,
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
  extractPhoneFromWebhook: jest.fn(),
}));

jest.mock('../services/whatsAppTemplateService', () => ({
  __esModule: true,
  WhatsAppTemplateService: jest.fn().mockImplementation(() => ({
    handleTemplateStatusUpdate: jest.fn(),
  })),
}));

const mockedMessageRepo = messageRepo as jest.Mocked<typeof messageRepo>;
const mockedCampaignRepo = campaignRepo as jest.Mocked<typeof campaignRepo>;
const mockedWebhookEventRepo = webhookEventRepo as jest.Mocked<typeof webhookEventRepo>;

const WEBHOOK_URL = '/webhooks/whatsapp';
const FAKE_WEBHOOK_EVENT = { id: 'we-1' };

function buildPayload(statuses: Array<{
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code: number; title: string }>;
}>) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'entry-123',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: {
            display_phone_number: '+15550001234',
            phone_number_id: 'phone-123',
          },
          statuses: statuses.map((s) => ({
            timestamp: '1700000000',
            recipient_id: '+1234567890',
            ...s,
          })),
        },
      }],
    }],
  };
}

describe('POST /webhooks/whatsapp — delivery status tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWebhookEventRepo.findByExternalId.mockResolvedValue(null);
    mockedWebhookEventRepo.create.mockResolvedValue(FAKE_WEBHOOK_EVENT as never);
    mockedWebhookEventRepo.markAsProcessed.mockResolvedValue(FAKE_WEBHOOK_EVENT as never);
    mockedWebhookEventRepo.markAsFailed.mockResolvedValue(FAKE_WEBHOOK_EVENT as never);
  });

  it('persists delivered status and increments campaign deliveredCount', async () => {
    const message = { id: 'msg-1', campaignId: 'camp-1' };
    mockedMessageRepo.updateStatusByWhatsAppMessageId.mockResolvedValue(message as never);
    mockedCampaignRepo.incrementDeliveredCount.mockResolvedValue({} as never);

    const res = await request(app)
      .post(WEBHOOK_URL)
      .send(buildPayload([{ id: 'wamid.abc', status: 'delivered' }]));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockedMessageRepo.updateStatusByWhatsAppMessageId).toHaveBeenCalledWith(
      'wamid.abc',
      'delivered',
      undefined,
      undefined,
    );
    expect(mockedCampaignRepo.incrementDeliveredCount).toHaveBeenCalledWith('camp-1');
    expect(mockedWebhookEventRepo.markAsProcessed).toHaveBeenCalledWith('we-1');
  });

  it('skips processing for duplicate webhook (same externalId already in DB)', async () => {
    mockedWebhookEventRepo.findByExternalId.mockResolvedValue(FAKE_WEBHOOK_EVENT as never);

    const res = await request(app)
      .post(WEBHOOK_URL)
      .send(buildPayload([{ id: 'wamid.abc', status: 'delivered' }]));

    expect(res.status).toBe(200);
    expect(mockedMessageRepo.updateStatusByWhatsAppMessageId).not.toHaveBeenCalled();
    expect(mockedWebhookEventRepo.create).not.toHaveBeenCalled();
  });

  it('persists read status and increments campaign readCount', async () => {
    const message = { id: 'msg-2', campaignId: 'camp-2' };
    mockedMessageRepo.updateStatusByWhatsAppMessageId.mockResolvedValue(message as never);
    mockedCampaignRepo.incrementReadCount.mockResolvedValue({} as never);

    const res = await request(app)
      .post(WEBHOOK_URL)
      .send(buildPayload([{ id: 'wamid.read1', status: 'read' }]));

    expect(res.status).toBe(200);
    expect(mockedMessageRepo.updateStatusByWhatsAppMessageId).toHaveBeenCalledWith(
      'wamid.read1',
      'read',
      undefined,
      undefined,
    );
    expect(mockedCampaignRepo.incrementReadCount).toHaveBeenCalledWith('camp-2');
  });

  it('does not increment campaign counter when message not found in DB', async () => {
    mockedMessageRepo.updateStatusByWhatsAppMessageId.mockResolvedValue(null);

    const res = await request(app)
      .post(WEBHOOK_URL)
      .send(buildPayload([{ id: 'wamid.unknown', status: 'delivered' }]));

    expect(res.status).toBe(200);
    expect(mockedCampaignRepo.incrementDeliveredCount).not.toHaveBeenCalled();
    expect(mockedWebhookEventRepo.markAsProcessed).toHaveBeenCalledWith('we-1');
  });

  it('persists failed status with error info and increments campaign failedCount', async () => {
    const message = { id: 'msg-3', campaignId: 'camp-3' };
    mockedMessageRepo.updateStatusByWhatsAppMessageId.mockResolvedValue(message as never);
    mockedCampaignRepo.incrementFailedCount.mockResolvedValue({} as never);

    const res = await request(app)
      .post(WEBHOOK_URL)
      .send(buildPayload([{
        id: 'wamid.fail1',
        status: 'failed',
        errors: [{ code: 131047, title: 'Re-engagement message' }],
      }]));

    expect(res.status).toBe(200);
    expect(mockedMessageRepo.updateStatusByWhatsAppMessageId).toHaveBeenCalledWith(
      'wamid.fail1',
      'failed',
      '131047',
      'Re-engagement message',
    );
    expect(mockedCampaignRepo.incrementFailedCount).toHaveBeenCalledWith('camp-3');
  });
});
