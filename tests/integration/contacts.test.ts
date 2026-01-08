import createTestRequest from '../helpers/testUtils';
import prisma from '../../src/utils/prisma';
import { createUserData } from '../factories/userFactory';
import { createContactData } from '../factories/contactFactory';

describe('Contacts API', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: createUserData({ email: 'contact-test@example.com' }),
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.contact.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up contacts after each test
    await prisma.contact.deleteMany({ where: { userId: testUserId } });
  });

  describe('POST /api/v1/contacts - Create Contact', () => {
    it('should create a contact with valid data', async () => {
      const response = await createTestRequest()
        .post('/api/v1/contacts')
        .send({
          userId: testUserId,
          phone: '+14155552671',
          name: 'John Doe',
          email: 'john@example.com',
          tags: ['vip', 'customer'],
          optedIn: true,
          optInSource: 'manual',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.phone).toBe('+14155552671');
      expect(response.body.data.name).toBe('John Doe');
      expect(response.body.data.email).toBe('john@example.com');
      expect(response.body.data.tags).toEqual(['vip', 'customer']);
      expect(response.body.data.optedIn).toBe(true);
    });

    it('should reject invalid phone number format', async () => {
      const response = await createTestRequest()
        .post('/api/v1/contacts')
        .send({
          userId: testUserId,
          phone: '123',
          name: 'John Doe',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('phone');
    });

    it('should reject duplicate phone numbers for same user', async () => {
      // Create first contact
      await createTestRequest()
        .post('/api/v1/contacts')
        .send({
          userId: testUserId,
          phone: '+14155552671',
          name: 'John Doe',
        })
        .expect(201);

      // Try to create duplicate
      const response = await createTestRequest()
        .post('/api/v1/contacts')
        .send({
          userId: testUserId,
          phone: '+14155552671',
          name: 'Jane Doe',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should format phone number to E.164', async () => {
      const response = await createTestRequest()
        .post('/api/v1/contacts')
        .send({
          userId: testUserId,
          phone: '+1 (415) 555-2671',
          name: 'John Doe',
        })
        .expect(201);

      expect(response.body.data.phone).toBe('+14155552671');
    });

    it('should create contact with minimal data', async () => {
      const response = await createTestRequest()
        .post('/api/v1/contacts')
        .send({
          userId: testUserId,
          phone: '+14155552671',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toBe('+14155552671');
    });
  });

  describe('GET /api/v1/contacts/:id - Get Contact', () => {
    it('should get a contact by ID', async () => {
      // Create a contact
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, phone: '+14155552671' }),
      });

      const response = await createTestRequest()
        .get(`/api/v1/contacts/${contact.id}`)
        .query({ userId: testUserId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(contact.id);
      expect(response.body.data.phone).toBe('+14155552671');
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await createTestRequest()
        .get(`/api/v1/contacts/${fakeId}`)
        .query({ userId: testUserId })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 if userId is missing', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId }),
      });

      await createTestRequest()
        .get(`/api/v1/contacts/${contact.id}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/contacts - List Contacts', () => {
    beforeEach(async () => {
      // Create multiple contacts
      await prisma.contact.createMany({
        data: [
          createContactData({ userId: testUserId, phone: '+14155552671', name: 'Alice', tags: ['vip'] }),
          createContactData({ userId: testUserId, phone: '+14155552672', name: 'Bob', tags: ['customer'] }),
          createContactData({ userId: testUserId, phone: '+14155552673', name: 'Charlie', optedIn: false }),
        ],
      });
    });

    it('should list all contacts for a user', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts')
        .query({ userId: testUserId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination.total).toBe(3);
    });

    it('should filter by opted-in status', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts')
        .query({ userId: testUserId, optedIn: true })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((c: any) => c.optedIn)).toBe(true);
    });

    it('should filter by tags', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts')
        .query({ userId: testUserId, tags: 'vip' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].tags).toContain('vip');
    });

    it('should search by name', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts')
        .query({ userId: testUserId, search: 'alice' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Alice');
    });

    it('should paginate results', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts')
        .query({ userId: testUserId, limit: 2, offset: 0 })
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(3);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should sort by name', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts')
        .query({ userId: testUserId, sortBy: 'name', order: 'asc' })
        .expect(200);

      expect(response.body.data[0].name).toBe('Alice');
      expect(response.body.data[1].name).toBe('Bob');
      expect(response.body.data[2].name).toBe('Charlie');
    });
  });

  describe('PUT /api/v1/contacts/:id - Update Contact', () => {
    it('should update contact details', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, phone: '+14155552671' }),
      });

      const response = await createTestRequest()
        .put(`/api/v1/contacts/${contact.id}`)
        .query({ userId: testUserId })
        .send({
          name: 'Updated Name',
          email: 'updated@example.com',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.email).toBe('updated@example.com');
    });

    it('should update phone number', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, phone: '+14155552671' }),
      });

      const response = await createTestRequest()
        .put(`/api/v1/contacts/${contact.id}`)
        .query({ userId: testUserId })
        .send({
          phone: '+14155559999',
        })
        .expect(200);

      expect(response.body.data.phone).toBe('+14155559999');
    });

    it('should reject duplicate phone number', async () => {
      const contact1 = await prisma.contact.create({
        data: createContactData({ userId: testUserId, phone: '+14155552671' }),
      });
      await prisma.contact.create({
        data: createContactData({ userId: testUserId, phone: '+14155552672' }),
      });

      const response = await createTestRequest()
        .put(`/api/v1/contacts/${contact1.id}`)
        .query({ userId: testUserId })
        .send({
          phone: '+14155552672',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('DELETE /api/v1/contacts/:id - Delete Contact', () => {
    it('should delete a contact', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId }),
      });

      const response = await createTestRequest()
        .delete(`/api/v1/contacts/${contact.id}`)
        .query({ userId: testUserId })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify it's deleted
      const deleted = await prisma.contact.findUnique({ where: { id: contact.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('POST /api/v1/contacts/:id/opt-in - Opt-in Contact', () => {
    it('should opt-in a contact', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, optedIn: false }),
      });

      const response = await createTestRequest()
        .post(`/api/v1/contacts/${contact.id}/opt-in`)
        .query({ userId: testUserId })
        .send({ optInSource: 'api' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optedIn).toBe(true);
      expect(response.body.data.optedInAt).toBeDefined();
      expect(response.body.data.optInSource).toBe('api');
    });
  });

  describe('POST /api/v1/contacts/:id/opt-out - Opt-out Contact', () => {
    it('should opt-out a contact', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, optedIn: true }),
      });

      const response = await createTestRequest()
        .post(`/api/v1/contacts/${contact.id}/opt-out`)
        .query({ userId: testUserId })
        .send({ reason: 'User request' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optedIn).toBe(false);
      expect(response.body.data.optedOutAt).toBeDefined();
    });
  });

  describe('POST /api/v1/contacts/bulk-opt-in - Bulk Opt-in', () => {
    it('should opt-in multiple contacts', async () => {
      const contact1 = await prisma.contact.create({
        data: createContactData({ userId: testUserId, optedIn: false }),
      });
      const contact2 = await prisma.contact.create({
        data: createContactData({ userId: testUserId, optedIn: false }),
      });

      const response = await createTestRequest()
        .post('/api/v1/contacts/bulk-opt-in')
        .send({
          userId: testUserId,
          contactIds: [contact1.id, contact2.id],
          optInSource: 'api',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(2);
      expect(response.body.data.failed).toBe(0);

      // Verify contacts are opted in
      const contacts = await prisma.contact.findMany({
        where: { id: { in: [contact1.id, contact2.id] } },
      });
      expect(contacts.every((c) => c.optedIn)).toBe(true);
    });
  });

  describe('PATCH /api/v1/contacts/:id/tags - Update Tags', () => {
    it('should add tags to a contact', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, tags: ['customer'] }),
      });

      const response = await createTestRequest()
        .patch(`/api/v1/contacts/${contact.id}/tags`)
        .query({ userId: testUserId })
        .send({
          action: 'add',
          tags: ['vip', 'premium'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toContain('customer');
      expect(response.body.data.tags).toContain('vip');
      expect(response.body.data.tags).toContain('premium');
    });

    it('should remove tags from a contact', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, tags: ['vip', 'customer', 'premium'] }),
      });

      const response = await createTestRequest()
        .patch(`/api/v1/contacts/${contact.id}/tags`)
        .query({ userId: testUserId })
        .send({
          action: 'remove',
          tags: ['vip'],
        })
        .expect(200);

      expect(response.body.data.tags).not.toContain('vip');
      expect(response.body.data.tags).toContain('customer');
      expect(response.body.data.tags).toContain('premium');
    });

    it('should set tags for a contact', async () => {
      const contact = await prisma.contact.create({
        data: createContactData({ userId: testUserId, tags: ['old1', 'old2'] }),
      });

      const response = await createTestRequest()
        .patch(`/api/v1/contacts/${contact.id}/tags`)
        .query({ userId: testUserId })
        .send({
          action: 'set',
          tags: ['new1', 'new2'],
        })
        .expect(200);

      expect(response.body.data.tags).toEqual(['new1', 'new2']);
    });
  });

  describe('GET /api/v1/tags - Get All Tags', () => {
    it('should return all unique tags with counts', async () => {
      await prisma.contact.createMany({
        data: [
          createContactData({ userId: testUserId, tags: ['vip', 'customer'] }),
          createContactData({ userId: testUserId, tags: ['vip'] }),
          createContactData({ userId: testUserId, tags: ['customer'] }),
        ],
      });

      const response = await createTestRequest()
        .get('/api/v1/tags')
        .query({ userId: testUserId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);

      const vipTag = response.body.data.find((t: any) => t.tag === 'vip');
      expect(vipTag.count).toBe(2);

      const customerTag = response.body.data.find((t: any) => t.tag === 'customer');
      expect(customerTag.count).toBe(2);
    });
  });
});
