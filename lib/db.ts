import { PrismaClient } from "@/app/generated/prisma";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use Neon serverless adapter for production
const createPrismaClient = () => {
  // Always use serverless adapter with Neon connection pooling
  if (process.env.DATABASE_URL) {
    const pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({
      adapter,
      log: ["error"],
    });
  }

  // Fallback (should not happen)
  return new PrismaClient({
    log: ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
