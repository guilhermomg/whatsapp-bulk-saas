import createTestRequest from '../helpers/testUtils';

describe('Health Check API', () => {
  describe('GET /api/v1/health', () => {
    it('should return 200 and health status', async () => {
      const response = await createTestRequest().get('/api/v1/health').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'API is running');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('environment');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('memory');
    });

    it('should include request ID in response headers', async () => {
      const response = await createTestRequest().get('/api/v1/health').expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers['x-request-id']).toBeTruthy();
    });
  });

  describe('GET /api/v1/nonexistent', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await createTestRequest().get('/api/v1/nonexistent').expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Not Found');
    });
  });
});
