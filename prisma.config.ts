// Prisma Client singleton for reuse across the application
// This ensures we don't create multiple connections
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
