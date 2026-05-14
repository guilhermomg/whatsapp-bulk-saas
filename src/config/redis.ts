import Redis from 'ioredis';
import logger from './logger';

const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisConnection: Redis | null = null;

if (REDIS_ENABLED) {
  redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redisConnection.on('connect', () => {
    logger.info('Redis connected');
  });

  redisConnection.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message });
  });
} else {
  logger.info('Redis disabled (REDIS_ENABLED=false) — campaign queue unavailable');
}

export default redisConnection;
