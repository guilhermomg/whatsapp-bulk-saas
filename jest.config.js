module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js',
    '!src/server.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 50,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
