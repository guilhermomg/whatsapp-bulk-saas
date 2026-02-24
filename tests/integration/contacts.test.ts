import { PrismaClient } from '@prisma/client';
import createTestRequest, { createAuthenticatedRequest } from '../helpers/testUtils';

const prisma = new PrismaClient();
let authToken: string;

describe('Contacts API', () => {
  beforeAll(async () => {
    await prisma.contact.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'contacts@test.com' } });

    const registerResponse = await createTestRequest()
      .post('/api/v1/auth/register')
      .send({
        email: 'contacts@test.com',
        password: 'Test123!@#',
      });

    authToken = registerResponse.body.data.token;
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({});
    await prisma.user.deleteMany({ where: { email: 'contacts@test.com' } });
    await prisma.$disconnect();
  });

  it('should create a contact with valid data', async () => {
    const response = await createAuthenticatedRequest(authToken)
      .post('/api/v1/contacts')
      .send({
        phone: '+14155552671',
        name: 'John Doe',
        optedIn: true,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.contact.phone).toBe('+14155552671');
  });

  it('should list contacts with pagination', async () => {
    const response = await createAuthenticatedRequest(authToken)
      .get('/api/v1/contacts?limit=10&offset=0')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.contacts).toBeDefined();
  });
});
