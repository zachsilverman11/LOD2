import { config } from "dotenv";

config();

/**
 * Create test leads for Greg and Jakub
 * Uses their real phone numbers so they can experience the AI system
 */

const WEBHOOK_URL = "https://lod2.vercel.app/api/webhooks/leads-on-demand";

async function createTestLead(name: string, phone: string, email: string) {
  console.log(`\n📝 Creating test lead for ${name}...`);

  const testLead = {
    name: name,
    email: email,
    phone: phone,
    consent: "TRUE",
    loanType: "purchase",
    loanAmount: "650000",
    purchasePrice: "850000",
    downPayment: "200000",
    creditScore: "740",
    propertyType: "Townhouse",
    city: "Vancouver",
    province: "BC"
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testLead),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(`✅ Lead created for ${name}`);
      console.log(`   Lead ID: ${result.leadId}`);
      console.log(`   Phone: ${phone}`);
      console.log(`   ${name} should receive an SMS from Holly within 5 seconds!`);
      return { success: true, leadId: result.leadId };
    } else {
      console.log(`❌ Failed to create lead for ${name}`);
      console.log(`   Error: ${JSON.stringify(result)}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`❌ Error creating lead for ${name}`);
    console.log(`   Error: ${error}`);
    return { success: false };
  }
}

async function main() {
  console.log("═".repeat(70));
  console.log("  🧪 CREATING TEST LEADS FOR TEAM");
  console.log("  Greg and Jakub will receive AI-powered SMS from Holly");
  console.log("═".repeat(70));

  // You'll need to replace these with Greg and Jakub's actual phone numbers
  console.log("\n⚠️  Please provide phone numbers:");
  console.log("   What is Greg's phone number? (format: 6041234567)");
  console.log("   What is Jakub's phone number? (format: 6041234567)");
  console.log("\nOnce you provide the numbers, I'll create the test leads!");
  console.log("\n📋 WHAT THEY'LL EXPERIENCE:");
  console.log("   1. Receive initial SMS from Holly within 5 seconds");
  console.log("   2. Can reply to the SMS");
  console.log("   3. AI will respond contextually to their replies");
  console.log("   4. Can test booking a call via Cal.com link");
  console.log("   5. See their lead in the dashboard");
  console.log("\n💡 SUGGESTED REPLIES TO TEST:");
  console.log("   - 'Yes, I'm interested!'");
  console.log("   - 'Tell me more about the programs'");
  console.log("   - 'Can you send me the booking link?'");
  console.log("   - 'What's my timeline?'");
  console.log("\n");

  // Uncomment and add actual phone numbers when ready:
  /*
  const gregResult = await createTestLead(
    "Greg Williamson",
    "6041234567", // Replace with Greg's actual number
    "greg@inspired.mortgage"
  );

  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between leads

  const jakubResult = await createTestLead(
    "Jakub Huncik",
    "6041234568", // Replace with Jakub's actual number
    "jakub@inspired.mortgage"
  );

  console.log("\n═".repeat(70));
  console.log("  ✅ TEST LEADS CREATED!");
  console.log("  Both Greg and Jakub should have received SMS from Holly");
  console.log("  View them in dashboard: https://lod2.vercel.app/dashboard");
  console.log("═".repeat(70));
  */
}

main();
