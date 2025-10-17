import { prisma } from '@/lib/db';

async function analyzeLeadJourney(email: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { email },
      include: {
        communications: {
          orderBy: { createdAt: 'asc' },
        },
        appointments: {
          orderBy: { createdAt: 'asc' },
        },
        callOutcomes: {
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });

    if (!lead) {
      console.log(`❌ Lead not found: ${email}`);
      return;
    }

    const rawData = lead.rawData as any;

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    LEAD JOURNEY ANALYSIS                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log('## LEAD PROFILE\n');
    console.log(`Name: ${lead.firstName} ${lead.lastName}`);
    console.log(`Email: ${lead.email}`);
    console.log(`Phone: ${lead.phone || 'N/A'}`);
    console.log(`Status: ${lead.status}`);
    console.log(`Created: ${lead.createdAt.toLocaleString()}`);
    console.log(
      `Days in pipeline: ${Math.floor((Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24))}`
    );

    if (rawData) {
      console.log(`\n## LEAD DETAILS\n`);
      console.log(`Type: ${rawData.loanType || rawData.lead_type || 'Unknown'}`);
      console.log(`Location: ${rawData.city ? `${rawData.city}, ` : ''}${rawData.province || 'Unknown'}`);
      if (rawData.purchasePrice || rawData.home_value) {
        console.log(`Property Value: $${rawData.purchasePrice || rawData.home_value}`);
      }
      if (rawData.loanAmount) {
        console.log(`Loan Amount: $${rawData.loanAmount}`);
      }
      if (rawData.motivation_level) {
        console.log(`Urgency: ${rawData.motivation_level}`);
      }
    }

    // Appointments
    if (lead.appointments.length > 0) {
      console.log(`\n## APPOINTMENTS (${lead.appointments.length})\n`);
      lead.appointments.forEach((appt) => {
        console.log(
          `📅 ${(appt.scheduledFor || appt.scheduledAt).toLocaleString()} - ${appt.status}`
        );
        if (appt.advisorName) console.log(`   Advisor: ${appt.advisorName}`);
        if (appt.notes) console.log(`   Notes: ${appt.notes}`);
      });
    }

    // Call outcomes
    if (lead.callOutcomes.length > 0) {
      console.log(`\n## CALL OUTCOMES (${lead.callOutcomes.length})\n`);
      lead.callOutcomes.forEach((outcome) => {
        console.log(`📞 ${outcome.createdAt.toLocaleString()}`);
        console.log(`   Advisor: ${outcome.advisorName}`);
        console.log(`   Reached: ${outcome.reached ? 'Yes' : 'No'}`);
        console.log(`   Outcome: ${outcome.outcome}`);
        if (outcome.notes) console.log(`   Notes: ${outcome.notes}`);
      });
    }

    // Conversation history
    console.log(`\n## CONVERSATION HISTORY (${lead.communications.length} messages)\n`);

    const outboundCount = lead.communications.filter((c) => c.direction === 'OUTBOUND').length;
    const inboundCount = lead.communications.filter((c) => c.direction === 'INBOUND').length;

    console.log(`Outbound (Holly): ${outboundCount}`);
    console.log(`Inbound (Lead): ${inboundCount}`);
    console.log(`\n---\n`);

    lead.communications.forEach((comm, idx) => {
      const direction = comm.direction === 'OUTBOUND' ? '→ Holly' : '← Lead';
      const timestamp = comm.createdAt.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      console.log(`${idx + 1}. ${direction} (${timestamp})`);
      console.log(`   ${comm.content.substring(0, 150)}${comm.content.length > 150 ? '...' : ''}`);
      console.log('');
    });

    // Stage changes
    const stageChanges = lead.activities.filter((a) => a.type === 'STATUS_CHANGE');
    if (stageChanges.length > 0) {
      console.log(`\n## STAGE PROGRESSION (${stageChanges.length} changes)\n`);
      stageChanges.forEach((change) => {
        console.log(`${change.createdAt.toLocaleString()}: ${change.content}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    return lead;
  } catch (error) {
    console.error('Error analyzing lead:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: npx tsx scripts/analyze-lead-journey.ts email@example.com');
  process.exit(1);
}

analyzeLeadJourney(email);
