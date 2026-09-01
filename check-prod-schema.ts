/**
 * WARNING: reads the PRODUCTION database (read-only schema inspection).
 */
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
import { PrismaClient } from './app/generated/prisma';
import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL_UNPOOLED is not set. It must contain the non-pooled ' +
      '(no "-pooler" in the host) Neon connection string for the production database.'
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaNeonHTTP(pool);
const prisma = new PrismaClient({ adapter });

async function checkSchema() {
  try {
    // Try to query the enum values directly from PostgreSQL
    const result = await prisma.$queryRaw`
      SELECT unnest(enum_range(NULL::"LeadStatus"))::text AS status
      ORDER BY status;
    `;

    console.log('Production LeadStatus enum values:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
