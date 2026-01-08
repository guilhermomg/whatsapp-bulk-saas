import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

/**
 * Test database utilities for setting up and tearing down test data
 */
export class TestDatabase {
  /**
   * Clean all data from the database (for testing)
   */
  static async clean(): Promise<void> {
    // Delete in reverse order of dependencies
    await prisma.webhookEvent.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.campaign.deleteMany({});
    await prisma.template.deleteMany({});
    await prisma.contact.deleteMany({});
    await prisma.user.deleteMany({});
  }

  /**
   * Reset the database schema (use with caution)
   */
  static async reset(): Promise<void> {
    try {
      execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  static async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }

  /**
   * Get the Prisma client instance
   */
  static getPrisma(): PrismaClient {
    return prisma;
  }
}

/**
 * Jest setup helper for database tests
 */
export function setupTestDatabase() {
  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  beforeEach(async () => {
    // Clean data before each test
    await TestDatabase.clean();
  });

  afterAll(async () => {
    // Clean up and disconnect
    await TestDatabase.clean();
    await TestDatabase.disconnect();
  });
}

export default TestDatabase;
