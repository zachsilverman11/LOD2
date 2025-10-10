import { prisma } from "@/lib/db";

async function clearDevCards() {
  console.log("Deleting all dev cards...");

  const result = await prisma.devCard.deleteMany({});

  console.log(`✅ Deleted ${result.count} dev cards`);
}

clearDevCards()
  .catch((error) => {
    console.error("Error clearing dev cards:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
