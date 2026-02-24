import { PrismaClient } from '@prisma/client';
import createTestRequest from '../helpers/testUtils';

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
    const response = await createTestRequest()
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        phone: '+14155552671',
        name: 'John Doe',
        optedIn: true,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.phone).toBe('+14155552671');
  });

  it('should list contacts with pagination', async () => {
    const response = await createTestRequest()
      .get('/api/v1/contacts?limit=10&offset=0')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });
});
