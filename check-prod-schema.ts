import { PrismaNeonHTTP } from '@prisma/adapter-neon';
import { PrismaClient } from './app/generated/prisma';
import { Pool } from '@neondatabase/serverless';

const connectionString = 'postgresql://neondb_owner:npg_dEhcITmUYK49@ep-round-pine-adn431lh.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

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
