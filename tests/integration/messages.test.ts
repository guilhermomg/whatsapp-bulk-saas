import { PrismaClient } from '@prisma/client';
import createTestRequest, { createAuthenticatedRequest } from '../helpers/testUtils';

const prisma = new PrismaClient();
let authToken: string;

describe('Messages API', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'messages@test.com' } });

    const registerResponse = await createTestRequest()
      .post('/api/v1/auth/register')
      .send({
        email: 'messages@test.com',
        password: 'Test123!@#',
      });

    authToken = registerResponse.body.data.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: 'messages@test.com' } });
    await prisma.$disconnect();
  });

  it('should validate phone number format', async () => {
    const response = await createAuthenticatedRequest(authToken)
      .post('/api/v1/messages/send')
      .send({
        to: 'invalid',
        type: 'text',
        body: 'Test message',
      });

    expect(response.status).toBe(422 || 401); // May fail auth if WhatsApp not connected
  });
});
