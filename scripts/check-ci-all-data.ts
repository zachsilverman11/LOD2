import { PrismaClient } from '../app/generated/prisma';
const prisma = new PrismaClient();

async function checkCIAllData() {
  const lead = await prisma.lead.findFirst({
    where: {
      email: { equals: 'irwin_c@hotmail.com', mode: 'insensitive' }
    }
  });

  if (!lead) {
    console.log('Lead not found');
    return;
  }

  console.log('\n📋 FULL DATABASE DUMP FOR C I\n');
  console.log(JSON.stringify(lead, null, 2));

  // Check for ANY appointments with this leadId (even deleted)
  const appointments = await prisma.$queryRaw`
    SELECT * FROM "Appointment"
    WHERE "leadId" = ${lead.id}
    ORDER BY "createdAt" DESC
  `;

  console.log('\n\n📅 RAW APPOINTMENTS QUERY:');
  console.log(JSON.stringify(appointments, null, 2));

  // Check raw activities
  const activities = await prisma.$queryRaw`
    SELECT * FROM "LeadActivity"
    WHERE "leadId" = ${lead.id}
    ORDER BY "createdAt" DESC
    LIMIT 20
  `;

  console.log('\n\n📜 RAW ACTIVITIES:');
  console.log(JSON.stringify(activities, null, 2));

  await prisma.$disconnect();
}

checkCIAllData().catch(console.error).finally(() => process.exit(0));
