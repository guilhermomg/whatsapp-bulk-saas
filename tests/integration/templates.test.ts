import createTestRequest from '../helpers/testUtils';
import prisma from '../../src/utils/prisma';
import { createUserData } from '../factories/userFactory';
import { createTemplateData } from '../factories/templateFactory';

describe('Templates API', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: createUserData({ email: 'template-test@example.com' }),
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.template.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up templates after each test
    await prisma.template.deleteMany({ where: { userId: testUserId } });
  });

  describe('POST /api/v1/templates - Create Template', () => {
    it('should create a template with valid data', async () => {
      const response = await createTestRequest()
        .post('/api/v1/templates')
        .send({
          userId: testUserId,
          name: 'order_confirmation',
          language: 'en_US',
          category: 'utility',
          components: {
            body: {
              text: 'Hi {{1}}, your order {{2}} has been confirmed.',
              variables: ['name', 'order_id'],
            },
            footer: {
              text: 'Thank you for your purchase',
            },
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('order_confirmation');
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.category).toBe('utility');
    });

    it('should reject invalid template name format', async () => {
      const response = await createTestRequest()
        .post('/api/v1/templates')
        .send({
          userId: testUserId,
          name: 'Invalid Name With Spaces',
          category: 'utility',
          components: {
            body: {
              text: 'Test message',
            },
          },
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('lowercase');
    });

    it('should reject duplicate template names for same user', async () => {
      // Create first template
      await createTestRequest()
        .post('/api/v1/templates')
        .send({
          userId: testUserId,
          name: 'test_template',
          category: 'utility',
          components: {
            body: {
              text: 'Test message',
            },
          },
        })
        .expect(201);

      // Try to create duplicate
      const response = await createTestRequest()
        .post('/api/v1/templates')
        .send({
          userId: testUserId,
          name: 'test_template',
          category: 'marketing',
          components: {
            body: {
              text: 'Different message',
            },
          },
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject non-sequential variables', async () => {
      const response = await createTestRequest()
        .post('/api/v1/templates')
        .send({
          userId: testUserId,
          name: 'invalid_variables',
          category: 'utility',
          components: {
            body: {
              text: 'Hi {{1}}, your order {{3}} is ready.',
              variables: ['name', 'order_id'],
            },
          },
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('sequential');
    });

    it('should reject body text exceeding 1024 characters', async () => {
      const longText = 'a'.repeat(1025);
      const response = await createTestRequest()
        .post('/api/v1/templates')
        .send({
          userId: testUserId,
          name: 'too_long',
          category: 'utility',
          components: {
            body: {
              text: longText,
            },
          },
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('1024');
    });

    it('should create template with header, body, footer, and buttons', async () => {
      const response = await createTestRequest()
        .post('/api/v1/templates')
        .send({
          userId: testUserId,
          name: 'summer_sale',
          category: 'marketing',
          language: 'en_US',
          components: {
            header: {
              type: 'text',
              text: 'Summer Sale!',
            },
            body: {
              text: 'Hi {{1}}! Get {{2}}% off on all items.',
              variables: ['customer_name', 'discount_percentage'],
            },
            footer: {
              text: 'Valid until Aug 31',
            },
            buttons: [
              {
                type: 'url',
                text: 'Shop Now',
                url: 'https://shop.example.com',
              },
            ],
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.components.header.text).toBe('Summer Sale!');
      expect(response.body.data.components.buttons).toHaveLength(1);
    });
  });

  describe('GET /api/v1/templates/:id - Get Template', () => {
    it('should get template by ID', async () => {
      // Create template
      const template = await prisma.template.create({
        data: createTemplateData({ userId: testUserId }),
      });

      const response = await createTestRequest()
        .get(`/api/v1/templates/${template.id}`)
        .query({ userId: testUserId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(template.id);
    });

    it('should return 404 for non-existent template', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await createTestRequest()
        .get(`/api/v1/templates/${fakeId}`)
        .query({ userId: testUserId })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should not allow access to other users templates', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: createUserData({ email: 'other-user@example.com' }),
      });

      // Create template for other user
      const template = await prisma.template.create({
        data: createTemplateData({ userId: otherUser.id }),
      });

      // Try to access with testUserId
      const response = await createTestRequest()
        .get(`/api/v1/templates/${template.id}`)
        .query({ userId: testUserId })
        .expect(404);

      expect(response.body.success).toBe(false);

      // Clean up
      await prisma.template.delete({ where: { id: template.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('GET /api/v1/templates - List Templates', () => {
    it('should list templates with pagination', async () => {
      // Create multiple templates
      await Promise.all([
        prisma.template.create({
          data: createTemplateData({ userId: testUserId, name: 'template_1' }),
        }),
        prisma.template.create({
          data: createTemplateData({ userId: testUserId, name: 'template_2' }),
        }),
        prisma.template.create({
          data: createTemplateData({ userId: testUserId, name: 'template_3' }),
        }),
      ]);

      const response = await createTestRequest()
        .get('/api/v1/templates')
        .query({ userId: testUserId, limit: 2, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(3);
    });

    it('should filter templates by status', async () => {
      await Promise.all([
        prisma.template.create({
          data: createTemplateData({
            userId: testUserId,
            status: 'draft',
            name: 'draft_template',
          }),
        }),
        prisma.template.create({
          data: createTemplateData({
            userId: testUserId,
            status: 'approved',
            name: 'approved_template',
          }),
        }),
      ]);

      const response = await createTestRequest()
        .get('/api/v1/templates')
        .query({ userId: testUserId, status: 'approved' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('approved');
    });

    it('should filter templates by category', async () => {
      await Promise.all([
        prisma.template.create({
          data: createTemplateData({
            userId: testUserId,
            category: 'marketing',
            name: 'marketing_template',
          }),
        }),
        prisma.template.create({
          data: createTemplateData({
            userId: testUserId,
            category: 'utility',
            name: 'utility_template',
          }),
        }),
      ]);

      const response = await createTestRequest()
        .get('/api/v1/templates')
        .query({ userId: testUserId, category: 'utility' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe('utility');
    });

    it('should search templates by name', async () => {
      await Promise.all([
        prisma.template.create({
          data: createTemplateData({
            userId: testUserId,
            name: 'order_confirmation',
          }),
        }),
        prisma.template.create({
          data: createTemplateData({
            userId: testUserId,
            name: 'shipping_update',
          }),
        }),
      ]);

      const response = await createTestRequest()
        .get('/api/v1/templates')
        .query({ userId: testUserId, search: 'order' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('order_confirmation');
    });
  });

  describe('PUT /api/v1/templates/:id - Update Template', () => {
    it('should update a draft template', async () => {
      const template = await prisma.template.create({
        data: createTemplateData({
          userId: testUserId,
          status: 'draft',
          name: 'old_name',
        }),
      });

      const response = await createTestRequest()
        .put(`/api/v1/templates/${template.id}`)
        .query({ userId: testUserId })
        .send({
          name: 'new_name',
          category: 'authentication',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('new_name');
      expect(response.body.data.category).toBe('authentication');
    });

    it('should not update non-draft template', async () => {
      const template = await prisma.template.create({
        data: createTemplateData({
          userId: testUserId,
          status: 'approved',
        }),
      });

      const response = await createTestRequest()
        .put(`/api/v1/templates/${template.id}`)
        .query({ userId: testUserId })
        .send({
          name: 'new_name',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('draft');
    });
  });

  describe('DELETE /api/v1/templates/:id - Delete Template', () => {
    it('should delete a template', async () => {
      const template = await prisma.template.create({
        data: createTemplateData({ userId: testUserId }),
      });

      const response = await createTestRequest()
        .delete(`/api/v1/templates/${template.id}`)
        .query({ userId: testUserId })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = await prisma.template.findUnique({
        where: { id: template.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('POST /api/v1/templates/:id/preview - Preview Template', () => {
    it('should preview template with parameters', async () => {
      const template = await prisma.template.create({
        data: {
          ...createTemplateData({ userId: testUserId }),
          components: {
            body: {
              text: 'Hi {{1}}, your order {{2}} is ready.',
              variables: ['name', 'order_id'],
            },
            footer: {
              text: 'Thank you',
            },
          },
        },
      });

      const response = await createTestRequest()
        .post(`/api/v1/templates/${template.id}/preview`)
        .query({ userId: testUserId })
        .send({
          parameters: {
            name: 'John',
            order_id: '12345',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.body).toBe('Hi John, your order 12345 is ready.');
      expect(response.body.data.footer).toBe('Thank you');
    });

    it('should handle missing parameters in preview', async () => {
      const template = await prisma.template.create({
        data: {
          ...createTemplateData({ userId: testUserId }),
          components: {
            body: {
              text: 'Hi {{1}}, your order {{2}} is ready.',
              variables: ['name', 'order_id'],
            },
          },
        },
      });

      const response = await createTestRequest()
        .post(`/api/v1/templates/${template.id}/preview`)
        .query({ userId: testUserId })
        .send({
          parameters: {
            name: 'John',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Missing parameters should be left as placeholders
      expect(response.body.data.body).toContain('{{2}}');
    });
  });

  describe('POST /api/v1/templates/:id/validate - Validate Parameters', () => {
    it('should validate correct parameters', async () => {
      const template = await prisma.template.create({
        data: {
          ...createTemplateData({ userId: testUserId }),
          components: {
            body: {
              text: 'Hi {{1}}, your order {{2}} is ready.',
              variables: ['name', 'order_id'],
            },
          },
        },
      });

      const response = await createTestRequest()
        .post(`/api/v1/templates/${template.id}/validate`)
        .query({ userId: testUserId })
        .send({
          parameters: {
            name: 'John',
            order_id: '12345',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should detect missing parameters', async () => {
      const template = await prisma.template.create({
        data: {
          ...createTemplateData({ userId: testUserId }),
          components: {
            body: {
              text: 'Hi {{1}}, your order {{2}} is ready.',
              variables: ['name', 'order_id'],
            },
          },
        },
      });

      const response = await createTestRequest()
        .post(`/api/v1/templates/${template.id}/validate`)
        .query({ userId: testUserId })
        .send({
          parameters: {
            name: 'John',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors).toContain('Missing required parameter: order_id');
    });

    it('should detect extra parameters', async () => {
      const template = await prisma.template.create({
        data: {
          ...createTemplateData({ userId: testUserId }),
          components: {
            body: {
              text: 'Hi {{1}}.',
              variables: ['name'],
            },
          },
        },
      });

      const response = await createTestRequest()
        .post(`/api/v1/templates/${template.id}/validate`)
        .query({ userId: testUserId })
        .send({
          parameters: {
            name: 'John',
            extra: 'value',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors).toContain('Unexpected parameter: extra');
    });
  });

  describe('POST /api/v1/templates/sync - Sync Templates', () => {
    it('should accept sync request', async () => {
      // This is a placeholder test as actual Meta API integration
      // would be mocked in a real scenario
      const response = await createTestRequest()
        .post('/api/v1/templates/sync')
        .send({
          userId: testUserId,
          wabaId: 'test_waba_id',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('synced');
      expect(response.body.data).toHaveProperty('updated');
      expect(response.body.data).toHaveProperty('errors');
    });

    it('should reject sync without wabaId', async () => {
      const response = await createTestRequest()
        .post('/api/v1/templates/sync')
        .send({
          userId: testUserId,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('wabaId');
    });
  });
});
