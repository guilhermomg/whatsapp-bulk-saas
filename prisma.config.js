"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Prisma Client singleton for reuse across the application
// This ensures we don't create multiple connections
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.default = prisma;
