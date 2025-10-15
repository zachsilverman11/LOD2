import { PrismaClient, LeadStatus } from "@/app/generated/prisma";

const prisma = new PrismaClient();

async function fixMichaela() {
  // Michaela started her application so should be in APPLICATION_STARTED
  const result = await prisma.lead.update({
    where: { email: "michi.segal@gmail.com" },
    data: { status: LeadStatus.APPLICATION_STARTED },
  });

  console.log(`✅ Michaela Segal moved to APPLICATION_STARTED`);
  console.log(`   Application started: ${result.applicationStartedAt}`);

  await prisma.$disconnect();
}

fixMichaela();
