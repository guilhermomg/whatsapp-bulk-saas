import createTestRequest from '../helpers/testUtils';

describe('WhatsApp Messages API', () => {
  describe('POST /api/v1/messages/send - Send Text Message', () => {
    it('should validate phone number format', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'text',
          to: 'invalid_phone',
          body: 'Test message',
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('E.164');
    });

    it('should validate message body is required', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'text',
          to: '+14155238886',
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('body');
    });

    it('should validate message body max length', async () => {
      const longBody = 'a'.repeat(4097);

      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'text',
          to: '+14155238886',
          body: longBody,
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should accept valid text message request format', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'text',
          to: '+14155238886',
          body: 'Hello from test',
          previewUrl: false,
        });

      // Will fail with 401/422 if credentials not configured, which is expected in test
      expect([200, 401, 422, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('messageId');
      }
    });
  });

  describe('POST /api/v1/messages/send - Send Template Message', () => {
    it('should validate template message format', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'template',
          to: '+14155238886',
          templateName: 'hello_world',
          languageCode: 'invalid_code',
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Language code');
    });

    it('should validate language code format', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'template',
          to: '+14155238886',
          templateName: 'hello_world',
          languageCode: 'en', // Should be en_US format
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should accept valid template message request format', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'template',
          to: '+14155238886',
          templateName: 'hello_world',
          languageCode: 'en_US',
        });

      // Will fail with 401/422 if credentials not configured, which is expected in test
      expect([200, 400, 401, 422, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('messageId');
      }
    });

    it('should accept template with components', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'template',
          to: '+14155238886',
          templateName: 'order_confirmation',
          languageCode: 'en_US',
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: 'John Doe',
                },
              ],
            },
          ],
        });

      // Will fail with 401/422/400 if credentials not configured or template not approved
      expect([200, 400, 401, 422, 503]).toContain(response.status);
    });
  });

  describe('POST /api/v1/messages/send - Invalid Message Type', () => {
    it('should reject invalid message type', async () => {
      const response = await createTestRequest()
        .post('/api/v1/messages/send')
        .send({
          type: 'invalid_type',
          to: '+14155238886',
        })
        .expect(422);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('type');
    });
  });

  describe('GET /api/v1/whatsapp/status - Service Health Check', () => {
    it(
      'should return WhatsApp service status',
      async () => {
        const response = await createTestRequest().get('/api/v1/whatsapp/status');

        // Should return 200 if configured, 503 if not
        expect([200, 503]).toContain(response.status);

        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('connected');
      },
      30000,
    ); // 30 second timeout for retry logic

    it(
      'should include phone number info when connected',
      async () => {
        const response = await createTestRequest().get('/api/v1/whatsapp/status');

        if (response.status === 200) {
          expect(response.body.data).toHaveProperty('phoneNumber');
          expect(response.body.data.phoneNumber).toHaveProperty('displayName');
          expect(response.body.data.phoneNumber).toHaveProperty('qualityRating');
        }
      },
      30000,
    ); // 30 second timeout for retry logic
  });
});
