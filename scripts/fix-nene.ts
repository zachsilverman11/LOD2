import { PrismaClient, LeadStatus } from "@/app/generated/prisma";

const prisma = new PrismaClient();

async function fixNene() {
  const result = await prisma.lead.update({
    where: { email: "neneboeye@gmail.com" },
    data: { status: LeadStatus.LOST },
  });
  console.log(`✅ Nene Eye moved to LOST (was ${result.status})`);
  await prisma.$disconnect();
}

fixNene();
