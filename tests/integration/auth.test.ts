import { PrismaClient } from '@prisma/client';
import createTestRequest from '../helpers/testUtils';

const prisma = new PrismaClient();

describe('Authentication API', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await createTestRequest()
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'Test123!@#',
          businessName: 'Test Business',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      await createTestRequest()
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'Test123!@#',
        })
        .expect(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should reject login with invalid credentials', async () => {
      await createTestRequest()
        .post('/api/v1/auth/login')
        .send({
          email: 'newuser@test.com',
          password: 'WrongPass123!',
        })
        .expect(401);
    });
  });
});
