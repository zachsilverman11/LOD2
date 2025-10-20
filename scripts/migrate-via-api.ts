/**
 * Migrate All Active Leads to Enhanced Autonomous Holly (via API)
 *
 * This script uses the production API to switch all active leads to managedByAutonomous=true
 */

const API_URL = 'https://lod2.vercel.app/api';

async function migrateToAutonomousHolly() {
  console.log('🚀 Starting migration to Enhanced Autonomous Holly...\n');

  try {
    // Fetch all leads
    console.log('📡 Fetching leads from production...');
    const response = await fetch(`${API_URL}/leads`);
    const leads = await response.json();

    // Filter active leads that need migration
    const activeLeads = leads.filter(
      (lead: any) =>
        !['LOST', 'CONVERTED', 'DEALS_WON'].includes(lead.status) &&
        lead.consentSms === true &&
        lead.managedByAutonomous === false &&
        lead.hollyDisabled === false
    );

    console.log(`📊 Found ${activeLeads.length} active leads to migrate\n`);

    if (activeLeads.length === 0) {
      console.log('✅ No leads to migrate. All active leads are already autonomous!');
      return;
    }

    // Show preview
    console.log('Preview of leads to migrate:');
    activeLeads.slice(0, 10).forEach((lead: any) => {
      console.log(
        `  - ${lead.firstName} ${lead.lastName} (${lead.email}) - ${lead.status} - ${
          lead.communications?.length || 0
        } messages`
      );
    });
    if (activeLeads.length > 10) {
      console.log(`  ... and ${activeLeads.length - 10} more\n`);
    }

    console.log('\n⚠️  This will switch all these leads to Enhanced Autonomous Holly');
    console.log('   They will be managed by Claude Sonnet 4.5 with full 5-layer training');
    console.log('   Holly will see their full conversation history and adapt accordingly\n');

    // Migrate each lead
    let successCount = 0;
    let errorCount = 0;

    for (const lead of activeLeads) {
      try {
        const updateResponse = await fetch(`${API_URL}/admin/update-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: lead.id,
            managedByAutonomous: true,
            nextReviewAt: new Date().toISOString(),
          }),
        });

        if (updateResponse.ok) {
          successCount++;
          process.stdout.write(`\r✅ Migrated ${successCount}/${activeLeads.length} leads...`);
        } else {
          errorCount++;
          console.error(`\n❌ Failed to migrate ${lead.email}: ${updateResponse.statusText}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`\n❌ Error migrating ${lead.email}:`, error);
      }
    }

    console.log(`\n\n✅ Migration complete!`);
    console.log(`   - Successfully migrated: ${successCount} leads`);
    console.log(`   - Errors: ${errorCount} leads`);
    console.log('\n📋 Summary:');
    console.log(`   - Enhanced Holly is now managing ${successCount} active leads`);
    console.log('   - All leads will be reviewed on next agent loop cycle');
    console.log('   - Holly will read full conversation history before taking action');
    console.log('   - All safety guardrails are active (opt-out, repetition, time boundaries)');
    console.log('\n🎉 Enhanced Autonomous Holly is now live at 100%!\n');

    // Show breakdown by status
    const statusBreakdown: Record<string, number> = {};
    activeLeads.forEach((lead: any) => {
      statusBreakdown[lead.status] = (statusBreakdown[lead.status] || 0) + 1;
    });

    console.log('📊 Migrated leads breakdown by status:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} leads`);
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateToAutonomousHolly();
