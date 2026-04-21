import bcrypt from 'bcrypt';
import createTestRequest from '../helpers/testUtils';
import prisma from '../../src/utils/prisma';
import { generateToken } from '../../src/utils/jwtUtils';
import { encrypt } from '../../src/utils/encryption';

// Mock BullMQ queue so tests don't need Redis
jest.mock('../../src/queues/campaignQueue', () => ({
  __esModule: true,
  default: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    drain: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock ioredis connection to avoid Redis dependency
jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    connect: jest.fn(),
  },
}));

describe('Campaigns API', () => {
  let testUserId: string;
  let authToken: string;
  let testTemplateId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('Test123!@#', 12);
    const user = await prisma.user.create({
      data: {
        email: 'campaign-test@example.com',
        password: passwordHash,
        businessName: 'Campaign Test Business',
        wabaId: 'waba_campaign_test',
        phoneNumberId: 'phone_campaign_test',
        accessToken: encrypt('test_access_token'),
        isActive: true,
      },
    });
    testUserId = user.id;
    authToken = generateToken(testUserId, user.email);

    const template = await prisma.template.create({
      data: {
        userId: testUserId,
        name: 'campaign_test_template',
        language: 'en_US',
        category: 'marketing',
        status: 'approved',
        components: {
          body: { text: 'Hello {{1}}, check out our offer!' },
        },
        approvedAt: new Date(),
      },
    });
    testTemplateId = template.id;

    // Create opted-in contacts for start test
    await prisma.contact.createMany({
      data: [
        {
          userId: testUserId,
          phone: '+14155550001',
          name: 'Contact One',
          optedIn: true,
          optedInAt: new Date(),
        },
        {
          userId: testUserId,
          phone: '+14155550002',
          name: 'Contact Two',
          optedIn: true,
          optedInAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.campaign.deleteMany({ where: { userId: testUserId } });
    await prisma.contact.deleteMany({ where: { userId: testUserId } });
    await prisma.template.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.campaign.deleteMany({ where: { userId: testUserId } });
  });

  describe('POST /api/v1/campaigns - Create Campaign', () => {
    it('should create a campaign with status draft', async () => {
      const response = await createTestRequest()
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Black Friday Promo',
          templateId: testTemplateId,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Black Friday Promo');
      expect(response.body.data.status).toBe('draft');
    });

    it('should reject request without auth token', async () => {
      await createTestRequest()
        .post('/api/v1/campaigns')
        .send({ name: 'Test', templateId: testTemplateId })
        .expect(401);
    });

    it('should reject missing templateId', async () => {
      const response = await createTestRequest()
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Missing Template' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/campaigns - List Campaigns', () => {
    it('should return paginated list including created campaign', async () => {
      await prisma.campaign.create({
        data: {
          userId: testUserId,
          name: 'List Test Campaign',
          templateId: testTemplateId,
          messageType: 'template',
          messageContent: { contactFilter: {} },
        },
      });

      const response = await createTestRequest()
        .get('/api/v1/campaigns')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.data.some((c: any) => c.name === 'List Test Campaign')).toBe(true);
    });
  });

  describe('GET /api/v1/campaigns/:id - Campaign Detail', () => {
    it('should return campaign detail with stats at zero', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          userId: testUserId,
          name: 'Detail Test Campaign',
          templateId: testTemplateId,
          messageType: 'template',
          messageContent: { contactFilter: {} },
        },
      });

      const response = await createTestRequest()
        .get(`/api/v1/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(campaign.id);
      expect(response.body.data.stats.sent).toBe(0);
      expect(response.body.data.stats.delivered).toBe(0);
      expect(response.body.data.stats.failed).toBe(0);
      expect(response.body.data.stats.read).toBe(0);
      expect(response.body.data.stats.total).toBe(0);
    });
  });

  describe('PUT /api/v1/campaigns/:id - Update Campaign', () => {
    it('should update campaign name and return updated record', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          userId: testUserId,
          name: 'Original Name',
          templateId: testTemplateId,
          messageType: 'template',
          messageContent: { contactFilter: {} },
        },
      });

      const response = await createTestRequest()
        .put(`/api/v1/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });
  });

  describe('POST /api/v1/campaigns/:id/start - Start Campaign', () => {
    it('should enqueue jobs and set status to processing', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          userId: testUserId,
          name: 'Start Test Campaign',
          templateId: testTemplateId,
          messageType: 'template',
          messageContent: { contactFilter: {} },
        },
      });

      const response = await createTestRequest()
        .post(`/api/v1/campaigns/${campaign.id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('processing');
    });
  });

  describe('DELETE /api/v1/campaigns/:id - Delete Campaign', () => {
    it('should delete draft campaign and subsequent GET returns 404', async () => {
      const campaign = await prisma.campaign.create({
        data: {
          userId: testUserId,
          name: 'Delete Test Campaign',
          templateId: testTemplateId,
          messageType: 'template',
          messageContent: { contactFilter: {} },
        },
      });

      await createTestRequest()
        .delete(`/api/v1/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      await createTestRequest()
        .get(`/api/v1/campaigns/${campaign.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
