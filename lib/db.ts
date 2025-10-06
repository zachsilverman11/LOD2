import { PrismaClient } from "@/app/generated/prisma";
import { Pool } from "@vercel/postgres";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use Vercel Postgres adapter for serverless environments
const createPrismaClient = () => {
  if (process.env.POSTGRES_URL) {
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }

  // Fallback for local development
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
