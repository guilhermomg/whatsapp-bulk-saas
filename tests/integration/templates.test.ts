import { PrismaClient } from '@prisma/client';
import createTestRequest, { createAuthenticatedRequest } from '../helpers/testUtils';

const prisma = new PrismaClient();
let authToken: string;

describe('Templates API', () => {
  beforeAll(async () => {
    await prisma.template.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'templates@test.com' } });

    const registerResponse = await createTestRequest()
      .post('/api/v1/auth/register')
      .send({
        email: 'templates@test.com',
        password: 'Test123!@#',
      });

    authToken = registerResponse.body.data.token;
  });

  afterAll(async () => {
    await prisma.template.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'templates@test.com' } });
    await prisma.$disconnect();
  });

  it('should create a template with valid data', async () => {
    const response = await createAuthenticatedRequest(authToken)
      .post('/api/v1/templates')
      .send({
        name: 'test_template',
        category: 'marketing',
        language: 'en_US',
        components: {
          body: { text: 'Hello {{1}}!' },
        },
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.template.name).toBe('test_template');
  });

  it('should list templates', async () => {
    const response = await createAuthenticatedRequest(authToken)
      .get('/api/v1/templates')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });
});
