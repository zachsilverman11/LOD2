import { prisma } from "../lib/db";

async function main() {
  const result = await prisma.lead.deleteMany({
    where: {
      phone: {
        contains: "8974960",
      },
    },
  });
  console.log(`Deleted ${result.count} leads`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
