import request from 'supertest';
import app from '../../src/app';

const createTestRequest = () => request(app);

export default createTestRequest;
