const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');

let server;

const startServer = () => {
  server = app.listen(config.port, () => {
    logger.info(`Server running in ${config.env} mode on port ${config.port}`);
    logger.info(`API Documentation available at http://${config.host}:${config.port}/api-docs`);
    logger.info(
      `Health check available at http://${config.host}:${config.port}${config.api.prefix}/${config.api.version}/health`,
    );
  });
};

const gracefulShutdown = (signal) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force close server after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle SIGTERM
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
startServer();

module.exports = { server, startServer };
