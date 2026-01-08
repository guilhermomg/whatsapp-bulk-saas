import { PrismaClient } from '@prisma/client';
import config from '../config';
import logger from '../config/logger';

/**
 * Prisma Client singleton
 * This ensures we only create one instance of PrismaClient across the application
 * which is important for connection pooling and performance
 */

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: config.env === 'development' 
      ? ['query', 'error', 'warn']
      : ['error'],
    datasources: {
      db: {
        url: config.database.url,
      },
    },
  });
};

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT received, disconnecting Prisma Client');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, disconnecting Prisma Client');
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
