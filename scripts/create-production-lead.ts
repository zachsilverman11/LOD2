/**
 * Create a test lead in production and initiate a voice call
 */

async function createLeadAndCall() {
  const baseUrl = "https://lod2-a9incracj-zach-silvermans-projects.vercel.app";

  // Create lead
  console.log("Creating test lead...");
  const createResponse = await fetch(`${baseUrl}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "zach@inspired.mortgage",
      phone: "+16048974960",
      firstName: "Zach",
      lastName: "Silverman",
      source: "production-test",
      consentEmail: true,
      consentSms: true,
      consentCall: true,
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create lead: ${await createResponse.text()}`);
  }

  const lead = await createResponse.json();
  console.log("✅ Lead created:", lead.id);

  // Initiate call
  console.log("\nInitiating voice call...");
  const callResponse = await fetch(`${baseUrl}/api/voice/initiate-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leadId: lead.id }),
  });

  if (!callResponse.ok) {
    throw new Error(`Failed to initiate call: ${await callResponse.text()}`);
  }

  const callResult = await callResponse.json();
  console.log("✅ Call initiated:", callResult);
  console.log("\n📞 Holly should be calling you now at +16048974960");
  console.log("\nDuring the call:");
  console.log("1. Agree to book a discovery call");
  console.log("2. Provide your name and email when asked");
  console.log("3. Choose a date/time");
  console.log("4. Holly will call the bookAppointment function");
  console.log("5. The webhook will create an appointment in Cal.com");
  console.log("\nCheck the results at:");
  console.log(`- Dashboard: ${baseUrl}/dashboard`);
  console.log("- Cal.com: https://cal.com/bookings");
}

createLeadAndCall()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
