const request = require('supertest');
const app = require('../../src/app');

const createTestRequest = () => request(app);

module.exports = {
  createTestRequest,
};
