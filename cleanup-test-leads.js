const { PrismaClient } = require("./app/generated/prisma");
const prisma = new PrismaClient();

async function cleanup() {
  const result = await prisma.lead.deleteMany({
    where: {
      OR: [
        { phone: { contains: "604897" } },
        { email: { contains: "example.com" } }
      ]
    }
  });
  console.log(`Deleted ${result.count} test leads`);
  await prisma.$disconnect();
}

cleanup();
