import dotenv from 'dotenv';

dotenv.config();

import { Server } from 'http';
import app from './app';
import config from './config';
import logger from './config/logger';
import validateEnvironment from './utils/validateEnvironment';

interface ServerModule {
  server: Server | undefined;
  startServer: () => void;
}

const serverModule: ServerModule = {
  server: undefined,
  startServer: () => {
    // Validate environment configuration before starting
    validateEnvironment();

    serverModule.server = app.listen(config.port, () => {
      logger.info(`Server running in ${config.env} mode on port ${config.port}`);
      logger.info(`API Documentation available at http://${config.host}:${config.port}/api-docs`);
      logger.info(
        `Health check available at http://${config.host}:${config.port}${config.api.prefix}/${config.api.version}/health`,
      );
      logger.info(
        `WhatsApp webhook available at http://${config.host}:${config.port}/webhooks/whatsapp`,
      );
    });
  },
};

const gracefulShutdown = (signal: string): void => {
  logger.info(`${signal} signal received: closing HTTP server`);
  if (serverModule.server) {
    serverModule.server.close(() => {
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
process.on('unhandledRejection', (err: Error) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle SIGTERM
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
serverModule.startServer();

export default serverModule;
