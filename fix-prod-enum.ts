import { Pool } from '@neondatabase/serverless';

const connectionString = 'postgresql://neondb_owner:npg_dEhcITmUYK49@ep-round-pine-adn431lh.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString });

async function fixEnum() {
  const client = await pool.connect();

  try {
    // Check current enum values
    const currentValues = await client.query(`
      SELECT unnest(enum_range(NULL::"LeadStatus"))::text AS value ORDER BY value;
    `);

    console.log('Current enum values:', currentValues.rows.map(r => r.value));

    // Recreate the enum with correct values
    console.log('\nRecreating LeadStatus enum...');

    await client.query('BEGIN');

    // Rename old enum
    await client.query('ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old"');

    // Create new enum with correct values
    await client.query(`
      CREATE TYPE "LeadStatus" AS ENUM (
        'NEW',
        'CONTACTED',
        'ENGAGED',
        'CALL_SCHEDULED',
        'CALL_COMPLETED',
        'APPLICATION_STARTED',
        'CONVERTED',
        'NURTURING',
        'LOST'
      )
    `);

    // Update the Lead table
    await client.query(`
      ALTER TABLE "Lead"
      ALTER COLUMN status TYPE "LeadStatus"
      USING status::text::"LeadStatus"
    `);

    // Drop old enum
    await client.query('DROP TYPE "LeadStatus_old"');

    await client.query('COMMIT');

    // Verify
    const newValues = await client.query(`
      SELECT unnest(enum_range(NULL::"LeadStatus"))::text AS value ORDER BY value;
    `);

    console.log('\nNew enum values:', newValues.rows.map(r => r.value));
    console.log('\n✅ Enum updated successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixEnum();
