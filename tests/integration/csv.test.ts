import createTestRequest from '../helpers/testUtils';
import prisma from '../../src/utils/prisma';
import { createUserData } from '../factories/userFactory';
import { createContactData } from '../factories/contactFactory';

describe('CSV Import/Export API', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: createUserData({ email: 'csv-test@example.com' }),
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

  describe('POST /api/v1/contacts/import-csv - Import CSV', () => {
    it('should import contacts from valid CSV', async () => {
      const csvContent = `phone,name,email,tags,opt_in_source
+14155552671,John Doe,john@example.com,vip,manual
+551199887766,Maria Silva,maria@example.com,"customer,new",csv
+447911123456,James Smith,james@example.com,customer,api`;

      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from(csvContent), 'contacts.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.imported).toBe(3);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.duplicates).toBe(0);

      // Verify contacts were created
      const contacts = await prisma.contact.findMany({ where: { userId: testUserId } });
      expect(contacts).toHaveLength(3);
    });

    it('should handle CSV with missing optional fields', async () => {
      const csvContent = `phone,name,email,tags,opt_in_source
+14155552671,John Doe,,,
+14155552672,,,customer,`;

      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from(csvContent), 'contacts.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(2);

      const contacts = await prisma.contact.findMany({
        where: { userId: testUserId },
        orderBy: { phone: 'asc' },
      });
      expect(contacts[0].name).toBe('John Doe');
      expect(contacts[0].email).toBeNull();
      expect(contacts[1].tags).toContain('customer');
    });

    it('should detect and report invalid phone numbers', async () => {
      const csvContent = `phone,name,email,tags,opt_in_source
+14155552671,John Doe,john@example.com,,
123,Invalid,invalid@example.com,,
abc,Also Invalid,alsoinvalid@example.com,,`;

      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from(csvContent), 'contacts.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.failed).toBeGreaterThan(0);
      expect(response.body.data.errors).toHaveLength(2);
      expect(response.body.data.errors[0].error).toContain('phone');
    });

    it('should detect duplicate phone numbers', async () => {
      // Create existing contact
      await prisma.contact.create({
        data: createContactData({ userId: testUserId, phone: '+14155552671' }),
      });

      const csvContent = `phone,name,email,tags,opt_in_source
+14155552671,John Doe,john@example.com,,
+14155552672,Jane Doe,jane@example.com,,`;

      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from(csvContent), 'contacts.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.duplicates).toBe(1);
      expect(response.body.data.failed).toBe(1);
    });

    it('should handle large CSV files', async () => {
      // Generate CSV with 100 contacts
      let csvContent = 'phone,name,email,tags,opt_in_source\n';
      for (let i = 0; i < 100; i += 1) {
        csvContent += `+1415555${String(i).padStart(4, '0')},User ${i},user${i}@example.com,customer,csv\n`;
      }

      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from(csvContent), 'contacts.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(100);
      expect(response.body.data.failed).toBe(0);

      // Verify contacts were created
      const count = await prisma.contact.count({ where: { userId: testUserId } });
      expect(count).toBe(100);
    });

    it('should reject non-CSV files', async () => {
      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from('not a csv'), 'file.txt')
        .expect(500);

      // Multer should reject non-CSV files
      expect(response.body.success).toBe(false);
    });

    it('should require file upload', async () => {
      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should handle CSV with comma-separated tags', async () => {
      const csvContent = `phone,name,email,tags,opt_in_source
+14155552671,John Doe,john@example.com,"vip,customer,premium",manual`;

      const response = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from(csvContent), 'contacts.csv')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.imported).toBe(1);

      const contact = await prisma.contact.findFirst({ where: { userId: testUserId } });
      expect(contact?.tags).toEqual(['vip', 'customer', 'premium']);
    });
  });

  describe('GET /api/v1/contacts/export-csv - Export CSV', () => {
    beforeEach(async () => {
      // Create test contacts
      await prisma.contact.createMany({
        data: [
          createContactData({
            userId: testUserId,
            phone: '+14155552671',
            name: 'John Doe',
            email: 'john@example.com',
            tags: ['vip'],
            optedIn: true,
          }),
          createContactData({
            userId: testUserId,
            phone: '+14155552672',
            name: 'Jane Doe',
            email: 'jane@example.com',
            tags: ['customer'],
            optedIn: true,
          }),
          createContactData({
            userId: testUserId,
            phone: '+14155552673',
            name: 'Bob Smith',
            email: 'bob@example.com',
            tags: [],
            optedIn: false,
          }),
        ],
      });
    });

    it('should export all contacts as CSV', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts/export-csv')
        .query({ userId: testUserId })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('contacts.csv');

      const csvContent = response.text;
      expect(csvContent).toContain('phone,name,email,opted_in,tags,created_at');
      expect(csvContent).toContain('+14155552671');
      expect(csvContent).toContain('John Doe');
      expect(csvContent).toContain('jane@example.com');
    });

    it('should filter exported contacts by opted-in status', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts/export-csv')
        .query({ userId: testUserId, optedIn: true })
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('+14155552671');
      expect(csvContent).toContain('+14155552672');
      expect(csvContent).not.toContain('+14155552673'); // Bob is opted out
    });

    it('should filter exported contacts by tags', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts/export-csv')
        .query({ userId: testUserId, tags: 'vip' })
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('+14155552671'); // John has vip tag
      expect(csvContent).not.toContain('+14155552672'); // Jane doesn't have vip tag
    });

    it('should filter exported contacts by search', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts/export-csv')
        .query({ userId: testUserId, search: 'john' })
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('John Doe');
      expect(csvContent).not.toContain('Jane Doe');
    });

    it('should export empty CSV if no contacts', async () => {
      // Delete all contacts
      await prisma.contact.deleteMany({ where: { userId: testUserId } });

      const response = await createTestRequest()
        .get('/api/v1/contacts/export-csv')
        .query({ userId: testUserId })
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('phone,name,email,opted_in,tags,created_at');
      // Should only have header
      const lines = csvContent.trim().split('\n');
      expect(lines).toHaveLength(1);
    });

    it('should require userId parameter', async () => {
      const response = await createTestRequest()
        .get('/api/v1/contacts/export-csv')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('CSV Round-trip - Import and Export', () => {
    it('should successfully import and then export the same data', async () => {
      const originalCsvContent = `phone,name,email,tags,opt_in_source
+14155552671,John Doe,john@example.com,vip,manual
+551199887766,Maria Silva,maria@example.com,customer,csv`;

      // Import CSV
      const importResponse = await createTestRequest()
        .post('/api/v1/contacts/import-csv')
        .query({ userId: testUserId })
        .attach('file', Buffer.from(originalCsvContent), 'contacts.csv')
        .expect(200);

      expect(importResponse.body.data.imported).toBe(2);

      // Export CSV
      const exportResponse = await createTestRequest()
        .get('/api/v1/contacts/export-csv')
        .query({ userId: testUserId })
        .expect(200);

      const exportedCsvContent = exportResponse.text;
      expect(exportedCsvContent).toContain('+14155552671');
      expect(exportedCsvContent).toContain('John Doe');
      expect(exportedCsvContent).toContain('+551199887766');
      expect(exportedCsvContent).toContain('Maria Silva');
    });
  });
});
