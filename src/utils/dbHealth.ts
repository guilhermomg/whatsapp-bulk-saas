import prisma from './prisma';
import logger from '../config/logger';

interface HealthCheckResult {
  healthy: boolean;
  message: string;
  timestamp: Date;
  latency?: number;
}

/**
 * Checks database connectivity and returns health status
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    const latency = Date.now() - startTime;
    
    return {
      healthy: true,
      message: 'Database connection successful',
      timestamp: new Date(),
      latency,
    };
  } catch (error) {
    logger.error('Database health check failed', error);
    
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Database connection failed',
      timestamp: new Date(),
    };
  }
}

/**
 * Tests database connection on startup
 * Throws an error if connection fails
 */
export async function testDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to database', error);
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Disconnects from the database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from database', error);
  }
}
