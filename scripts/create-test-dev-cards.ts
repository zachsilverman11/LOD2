import { prisma } from "@/lib/db";

async function createTestDevCards() {
  console.log("Creating test dev cards...");

  // Sample manual cards
  const manualCards = [
    {
      title: "Add bulk lead import from CSV",
      description: "Allow team to upload CSV files with multiple leads at once instead of manually entering them one by one.",
      type: "FEATURE_REQUEST",
      priority: "MEDIUM",
      createdBy: "Zach",
    },
    {
      title: "Fix timezone display in appointment reminders",
      description: "Some users seeing UTC time instead of Pacific Time in their calendar invites.",
      type: "BUG_FIX",
      priority: "HIGH",
      createdBy: "Greg",
    },
    {
      title: "Optimize database queries for analytics page",
      description: "Analytics dashboard loading slowly when there are 500+ leads. Need to add better indexing.",
      type: "OPTIMIZATION",
      priority: "LOW",
      createdBy: "Zach",
    },
  ];

  // Sample AI-detected cards
  const aiCards = [
    {
      title: "12 SMS delivery failures detected in last 24h",
      description: "Multiple SMS messages are failing to send. This could indicate:\n- Invalid phone number formatting\n- Twilio account issues\n- Rate limiting\n- Recipient opt-outs",
      type: "BUG_FIX",
      priority: "HIGH",
      createdBy: "HOLLY_AI",
      metadata: {
        impact: "12 leads not contacted via SMS",
        evidence: "Sample errors: cm5x7y8z9..., cm5x8a1b2..., cm5x9c3d4...",
        suggestion: "Check Twilio logs, verify phone number formatting, review opt-out list",
        detectedAt: new Date().toISOString(),
      },
    },
    {
      title: "Engagement rate 45% is significantly below target 60%",
      description: "Current engagement rate is 15.0% below target.\n\nPossible causes:\n- Message templates not resonating\n- Wrong audience/lead quality\n- Timing of messages\n- Offer not compelling",
      type: "IMPROVEMENT",
      priority: "HIGH",
      createdBy: "HOLLY_AI",
      metadata: {
        impact: "47 contacted leads not engaging",
        evidence: "Actual: 45.0%, Target: 60.0%",
        suggestion: "A/B test new message templates, review lead source quality, adjust messaging timing",
        detectedAt: new Date().toISOString(),
      },
    },
  ];

  for (const cardData of [...manualCards, ...aiCards]) {
    const card = await prisma.devCard.create({
      data: cardData as any,
    });
    console.log(`✓ Created: ${card.title}`);
  }

  console.log("\n✅ Test dev cards created successfully!");
}

createTestDevCards()
  .catch((error) => {
    console.error("Error creating test cards:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
