import dotenv from 'dotenv';

process.stderr.write('[STARTUP] Loading environment variables...\n');
dotenv.config();
process.stderr.write(`[STARTUP] Environment variables loaded. NODE_ENV: ${process.env.NODE_ENV}, PORT: ${process.env.PORT}\n`);

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
    process.stderr.write('[STARTUP] Starting server...\n');
    try {
      // Validate environment configuration before starting
      process.stderr.write('[STARTUP] Validating environment...\n');
      validateEnvironment();
      process.stderr.write('[STARTUP] Environment validation passed\n');

      process.stderr.write(`[STARTUP] Listening on port ${config.port}\n`);
      serverModule.server = app.listen(config.port, () => {
        process.stderr.write('[STARTUP] ✓ Server listening successfully\n');
        logger.info(`Server running in ${config.env} mode on port ${config.port}`);
        logger.info(`API Documentation available at http://${config.host}:${config.port}/api-docs`);
        logger.info(
          `Health check available at http://${config.host}:${config.port}${config.api.prefix}/${config.api.version}/health`,
        );
        logger.info(
          `WhatsApp webhook available at http://${config.host}:${config.port}/webhooks/whatsapp`,
        );
      });
    } catch (error) {
      process.stderr.write(`[STARTUP ERROR] ${error}\n`);
      logger.error('Fatal error during server startup:', error);
      process.exit(1);
    }
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
