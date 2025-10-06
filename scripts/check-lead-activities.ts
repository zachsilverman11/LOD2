import { prisma } from "../lib/db";

async function main() {
  const leadId = process.argv[2] || "cmgfjbvh0000eii043r82tkx3";

  const activities = await prisma.leadActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`\n=== RECENT ACTIVITIES ===\n`);

  activities.forEach((act) => {
    console.log(`[${act.createdAt.toISOString()}] ${act.type}`);
    console.log(act.content || "");
    if (act.metadata) {
      console.log("Metadata:", JSON.stringify(act.metadata, null, 2));
    }
    console.log("");
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
