import { prisma } from "../lib/db";

const teamMembers = [
  {
    email: "greg@inspired.mortgage",
    name: "Greg Williamson",
    role: "ADVISOR" as const,
    calLink: "https://cal.com/team/inspired-mortgage/mortgage-discovery-call",
  },
  {
    email: "jakub@inspired.mortgage",
    name: "Jakub Huncik",
    role: "ADVISOR" as const,
    phone: "778-912-4488",
    calLink: "https://cal.com/team/inspired-mortgage/mortgage-discovery-call",
  },
  {
    email: "zach@inspired.mortgage",
    name: "Zach Silverman",
    role: "ADMIN" as const,
  },
  {
    email: "amanda@inspired.mortgage",
    name: "Amanda Schaffner",
    role: "ADMIN" as const,
  },
  {
    email: "kelly@inspired.mortgage",
    name: "Kelly Russell",
    role: "ADMIN" as const,
  },
];

async function seedUsers() {
  console.log("🌱 Seeding users...\n");

  for (const member of teamMembers) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {
        name: member.name,
        role: member.role,
        calLink: member.calLink,
      },
      create: member,
    });

    console.log(`✅ ${user.name} (${user.role})`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    if (user.calLink) {
      console.log(`   Cal Link: ${user.calLink}`);
    }
    console.log("");
  }

  console.log("🎉 User seeding complete!");
}

seedUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
