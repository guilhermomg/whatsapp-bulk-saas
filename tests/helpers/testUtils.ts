import request from 'supertest';
import app from '../../src/app';

const createTestRequest = () => request(app);

export const createAuthenticatedRequest = (token: string) => {
  return createTestRequest().set('Authorization', `Bearer ${token}`);
};

export default createTestRequest;
