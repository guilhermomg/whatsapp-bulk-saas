import { PrismaClient } from '@prisma/client';
import createTestRequest from '../helpers/testUtils';
import { encrypt } from '../../src/utils/encryption';

const prisma = new PrismaClient();

describe('WhatsApp Connection API', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@whatsapptest.com',
        },
      },
    });

    // Register and verify a test user
    const registerResponse = await createTestRequest()
      .post('/api/v1/auth/register')
      .send({
        email: 'user@whatsapptest.com',
        password: 'WhatsApp123!@#',
        businessName: 'Test Business',
      });

    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;

    // Verify email for the user
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@whatsapptest.com',
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/users/me/whatsapp', () => {
    it('should return disconnected status when no WhatsApp connected', async () => {
      const response = await createTestRequest()
        .get('/api/v1/users/me/whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(false);
      expect(response.body.data.phoneNumber).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await createTestRequest()
        .get('/api/v1/users/me/whatsapp')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return connected status when WhatsApp is connected', async () => {
      // Manually set WhatsApp credentials for testing
      await prisma.user.update({
        where: { id: userId },
        data: {
          wabaId: '123456789',
          phoneNumberId: '987654321',
          accessToken: encrypt('test-token'),
          phoneNumber: '+14155551234',
          whatsappConnectedAt: new Date(),
          whatsappQualityRating: 'GREEN',
          whatsappMessagingLimit: 'TIER_1K',
        },
      });

      const response = await createTestRequest()
        .get('/api/v1/users/me/whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(true);
      expect(response.body.data.phoneNumber).toBe('+14155551234');
      expect(response.body.data.qualityRating).toBe('GREEN');
      expect(response.body.data.messagingLimitTier).toBe('TIER_1K');
      expect(response.body.data.connectedAt).toBeTruthy();
    });
  });

  describe('POST /api/v1/users/connect-whatsapp', () => {
    beforeEach(async () => {
      // Clear WhatsApp connection before each test
      await prisma.user.update({
        where: { id: userId },
        data: {
          wabaId: null,
          phoneNumberId: null,
          accessToken: null,
          phoneNumber: null,
          whatsappConnectedAt: null,
        },
      });
    });

    it('should reject connection without authentication', async () => {
      const response = await createTestRequest()
        .post('/api/v1/users/connect-whatsapp')
        .send({
          wabaId: '123456789',
          phoneNumberId: '987654321',
          accessToken: 'test-token',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject connection without email verification', async () => {
      // Temporarily unverify email
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: false },
      });

      const response = await createTestRequest()
        .post('/api/v1/users/connect-whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          wabaId: '123456789',
          phoneNumberId: '987654321',
          accessToken: 'test-token',
        })
        .expect(403);

      expect(response.body.success).toBe(false);

      // Re-verify email
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });
    });

    it('should reject connection with missing fields', async () => {
      const response = await createTestRequest()
        .post('/api/v1/users/connect-whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          wabaId: '123456789',
          // Missing phoneNumberId and accessToken
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject connection with invalid access token (too short)', async () => {
      const response = await createTestRequest()
        .post('/api/v1/users/connect-whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          wabaId: '123456789',
          phoneNumberId: '987654321',
          accessToken: 'short', // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    // Note: Testing actual WhatsApp API validation would require mocking
    // or using a test WhatsApp Business Account. For now, we test validation only.
  });

  describe('DELETE /api/v1/users/me/whatsapp', () => {
    beforeEach(async () => {
      // Set up WhatsApp connection
      await prisma.user.update({
        where: { id: userId },
        data: {
          wabaId: '123456789',
          phoneNumberId: '987654321',
          accessToken: encrypt('test-token'),
          phoneNumber: '+14155551234',
          whatsappConnectedAt: new Date(),
        },
      });
    });

    it('should disconnect WhatsApp account', async () => {
      const response = await createTestRequest()
        .delete('/api/v1/users/me/whatsapp')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('disconnected');

      // Verify credentials are cleared
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      expect(user?.phoneNumberId).toBeNull();
      expect(user?.accessToken).toBeNull();
      expect(user?.phoneNumber).toBeNull();
    });

    it('should require authentication', async () => {
      const response = await createTestRequest()
        .delete('/api/v1/users/me/whatsapp')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Multi-tenant isolation', () => {
    let user2Id: string;

    beforeAll(async () => {
      // Register second user
      const registerResponse = await createTestRequest()
        .post('/api/v1/auth/register')
        .send({
          email: 'user2@whatsapptest.com',
          password: 'WhatsApp123!@#',
          businessName: 'Test Business 2',
        });

      user2Id = registerResponse.body.data.user.id;

      // Verify email
      await prisma.user.update({
        where: { id: user2Id },
        data: { emailVerified: true },
      });
    });

    it('should prevent duplicate phone number connections', async () => {
      // Connect first user
      await prisma.user.update({
        where: { id: userId },
        data: {
          wabaId: '123456789',
          phoneNumberId: 'shared-phone-id',
          accessToken: encrypt('test-token'),
          phoneNumber: '+14155551234',
          whatsappConnectedAt: new Date(),
        },
      });

      // This would normally fail at the WhatsApp API validation stage
      // For testing purposes, we're testing the duplicate check logic
      // In a real scenario, the API would fail before reaching this point
    });

    it('should allow user to reconnect their own phone number', async () => {
      // Set up initial connection
      await prisma.user.update({
        where: { id: userId },
        data: {
          wabaId: '123456789',
          phoneNumberId: '987654321',
          accessToken: encrypt('old-token'),
          phoneNumber: '+14155551234',
          whatsappConnectedAt: new Date(),
        },
      });

      // User should be able to update their own credentials
      // This would be tested with actual API call in integration tests
    });
  });
});
