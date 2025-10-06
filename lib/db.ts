import { PrismaClient } from "@/app/generated/prisma";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use Neon serverless adapter for production
const createPrismaClient = () => {
  // Configure WebSocket for Neon in Node.js environments
  if (typeof window === "undefined") {
    neonConfig.webSocketConstructor = ws;
  }

  // Use HTTP fetch mode for better serverless compatibility
  neonConfig.fetchConnectionCache = true;
  neonConfig.useSecureWebSocket = true;

  // Always use serverless adapter with Neon connection pooling
  if (process.env.DATABASE_URL) {
    try {
      const pool = new NeonPool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 15000, // 15 second timeout
        idleTimeoutMillis: 30000, // 30 second idle timeout
        maxUses: 100, // Reuse connections
      });
      const adapter = new PrismaNeon(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      });
    } catch (error) {
      console.error("Failed to create Prisma client with Neon adapter:", error);
      throw error;
    }
  }

  throw new Error("DATABASE_URL is not defined");
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
