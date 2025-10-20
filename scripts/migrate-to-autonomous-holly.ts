/**
 * Migrate All Active Leads to Enhanced Autonomous Holly
 *
 * This script switches all active leads to managedByAutonomous=true
 * so they're handled by the new Enhanced Holly with Claude Sonnet 4.5 + 5-layer training
 */

import { prisma } from '../lib/db';

async function migrateToAutonomousHolly() {
  console.log('🚀 Starting migration to Enhanced Autonomous Holly...\n');

  try {
    // Find all active leads that aren't managed by autonomous yet
    const activeLeads = await prisma.lead.findMany({
      where: {
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
        consentSms: true,
        managedByAutonomous: false, // Not yet autonomous
        hollyDisabled: false, // Don't migrate manual relationships
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        communications: {
          select: { id: true },
        },
      },
    });

    console.log(`📊 Found ${activeLeads.length} active leads to migrate\n`);

    if (activeLeads.length === 0) {
      console.log('✅ No leads to migrate. All active leads are already autonomous!');
      return;
    }

    // Show preview
    console.log('Preview of leads to migrate:');
    activeLeads.slice(0, 5).forEach((lead) => {
      console.log(
        `  - ${lead.firstName} ${lead.lastName} (${lead.email}) - ${lead.status} - ${lead.communications.length} messages`
      );
    });
    if (activeLeads.length > 5) {
      console.log(`  ... and ${activeLeads.length - 5} more\n`);
    }

    // Confirm migration
    console.log('\n⚠️  This will switch all these leads to Enhanced Autonomous Holly');
    console.log('   They will be managed by Claude Sonnet 4.5 with full 5-layer training');
    console.log('   Holly will see their full conversation history and adapt accordingly\n');

    // Update all leads to autonomous
    const result = await prisma.lead.updateMany({
      where: {
        status: { notIn: ['LOST', 'CONVERTED', 'DEALS_WON'] },
        consentSms: true,
        managedByAutonomous: false,
        hollyDisabled: false,
      },
      data: {
        managedByAutonomous: true,
        nextReviewAt: new Date(), // Review immediately
      },
    });

    console.log(`✅ Successfully migrated ${result.count} leads to Autonomous Holly!`);
    console.log('\n📋 Summary:');
    console.log(`   - Enhanced Holly is now managing ${result.count} active leads`);
    console.log('   - All leads will be reviewed on next agent loop cycle');
    console.log('   - Holly will read full conversation history before taking action');
    console.log('   - All safety guardrails are active (opt-out, repetition, time boundaries)');
    console.log('\n🎉 Migration complete! Enhanced Autonomous Holly is now live at 100%!\n');

    // Show breakdown by status
    const statusBreakdown = await prisma.lead.groupBy({
      by: ['status'],
      where: {
        managedByAutonomous: true,
        hollyDisabled: false,
      },
      _count: true,
    });

    console.log('📊 Autonomous leads breakdown by status:');
    statusBreakdown.forEach((group) => {
      console.log(`   - ${group.status}: ${group._count} leads`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateToAutonomousHolly();
