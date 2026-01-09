import { PrismaClient } from '@prisma/client';
import createTestRequest from '../helpers/testUtils';

const prisma = new PrismaClient();

describe('User Profile API', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@profiletest.com',
        },
      },
    });

    // Register a test user
    const response = await createTestRequest().post('/api/v1/auth/register').send({
      email: 'user@profiletest.com',
      password: 'Profile123!@#',
      businessName: 'Test Business',
    });

    authToken = response.body.data.token;
    userId = response.body.data.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@profiletest.com',
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('GET /api/v1/users/me', () => {
    it('should return user profile with valid token', async () => {
      const response = await createTestRequest()
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('user@profiletest.com');
      expect(response.body.data.user.businessName).toBe('Test Business');
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject request without authentication', async () => {
      const response = await createTestRequest().get('/api/v1/users/me').expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/users/me', () => {
    it('should update user profile', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessName: 'Updated Business',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.businessName).toBe('Updated Business');
    });

    it('should update WhatsApp Business Account info', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          wabaId: 'test-waba-id',
          phoneNumberId: 'test-phone-id',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.wabaId).toBe('test-waba-id');
      expect(response.body.data.user.phoneNumberId).toBe('test-phone-id');
    });

    it('should reject update without authentication', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me')
        .send({
          businessName: 'Should Fail',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject update with invalid data', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          businessName: 'a'.repeat(101), // Too long
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/users/me/password', () => {
    it('should change password with valid current password', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'Profile123!@#',
          newPassword: 'NewPassword123!@#',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed');

      // Verify can login with new password
      const loginResponse = await createTestRequest()
        .post('/api/v1/auth/login')
        .send({
          email: 'user@profiletest.com',
          password: 'NewPassword123!@#',
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      // Update authToken for subsequent tests
      authToken = loginResponse.body.data.token;
    });

    it('should reject password change with incorrect current password', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'AnotherNew123!@#',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Current password is incorrect');
    });

    it('should reject weak new password', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'NewPassword123!@#',
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject same password as new password', async () => {
      const response = await createTestRequest()
        .put('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'NewPassword123!@#',
          newPassword: 'NewPassword123!@#',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('must be different');
    });
  });
});
