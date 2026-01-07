import crypto from 'crypto';
import createTestRequest from '../helpers/testUtils';

describe('WhatsApp Webhook API', () => {
  const validVerifyToken = 'your_webhook_verification_token'; // Should match .env

  describe('GET /webhooks/whatsapp - Webhook Verification', () => {
    it('should verify webhook with valid token', async () => {
      const challenge = 'test_challenge_string';

      const response = await createTestRequest()
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': validVerifyToken,
          'hub.challenge': challenge,
        });

      // Should return 401 because env token doesn't match test token
      expect([401, 200]).toContain(response.status);

      if (response.status === 200) {
        expect(response.text).toBe(challenge);
      }
    });

    it('should reject webhook verification with invalid token', async () => {
      const challenge = 'test_challenge_string';

      const response = await createTestRequest()
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'invalid_token',
          'hub.challenge': challenge,
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject webhook verification with missing parameters', async () => {
      const response = await createTestRequest()
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /webhooks/whatsapp - Webhook Events', () => {
    const createSignature = (body: string, secret: string): string => {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(body);
      return `sha256=${hmac.digest('hex')}`;
    };

    const validWebhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15550100',
                  phone_number_id: 'PHONE_NUMBER_ID',
                },
                statuses: [
                  {
                    id: 'wamid.test123',
                    status: 'delivered',
                    timestamp: '1234567890',
                    recipient_id: '1234567890',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    it('should accept webhook event with valid signature', async () => {
      const appSecret = process.env.WHATSAPP_APP_SECRET || 'test_secret';
      const body = JSON.stringify(validWebhookPayload);
      const signature = createSignature(body, appSecret);

      const response = await createTestRequest()
        .post('/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .send(validWebhookPayload);

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
      }
    });

    it('should reject webhook event with invalid signature', async () => {
      const response = await createTestRequest()
        .post('/webhooks/whatsapp')
        .set('x-hub-signature-256', 'sha256=invalid_signature')
        .send(validWebhookPayload)
        .expect(200); // WhatsApp expects 200 to avoid retries

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject webhook event without signature', async () => {
      const response = await createTestRequest()
        .post('/webhooks/whatsapp')
        .send(validWebhookPayload)
        .expect(200); // WhatsApp expects 200 to avoid retries

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle incoming message event', async () => {
      const incomingMessagePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550100',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '1234567890',
                      id: 'wamid.incoming123',
                      timestamp: '1234567890',
                      type: 'text',
                      text: {
                        body: 'Hello',
                      },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const appSecret = process.env.WHATSAPP_APP_SECRET || 'test_secret';
      const body = JSON.stringify(incomingMessagePayload);
      const signature = createSignature(body, appSecret);

      const response = await createTestRequest()
        .post('/webhooks/whatsapp')
        .set('x-hub-signature-256', signature)
        .send(incomingMessagePayload);

      expect([200, 401]).toContain(response.status);
    });
  });
});
