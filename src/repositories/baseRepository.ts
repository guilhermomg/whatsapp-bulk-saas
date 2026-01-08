import { PrismaClient } from '@prisma/client';
import prisma from '../utils/prisma';

/**
 * Base Repository class providing common CRUD operations
 * All specific repositories should extend this class
 */
export abstract class BaseRepository<T> {
  protected prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Find a record by ID
   */
  abstract findById(id: string): Promise<T | null>;

  /**
   * Find all records with optional filtering and pagination
   */
  abstract findAll(options?: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }): Promise<T[]>;

  /**
   * Create a new record
   */
  abstract create(data: any): Promise<T>;

  /**
   * Update a record by ID
   */
  abstract update(id: string, data: any): Promise<T>;

  /**
   * Delete a record by ID
   */
  abstract delete(id: string): Promise<T>;

  /**
   * Count records with optional filtering
   */
  abstract count(where?: any): Promise<number>;
}
