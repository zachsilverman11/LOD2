/**
 * Generate password hash for AUTH_PASSWORD_HASH environment variable
 * Usage: npx tsx scripts/generate-password-hash.ts "your-password-here"
 */

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error("❌ Error: Please provide a password");
    console.log("\nUsage:");
    console.log('  npx tsx scripts/generate-password-hash.ts "your-password-here"');
    console.log("\nExample:");
    console.log('  npx tsx scripts/generate-password-hash.ts "MySecurePassword123!"');
    process.exit(1);
  }

  const hash = await hashPassword(password);

  console.log("\n✅ Password hash generated successfully!\n");
  console.log("Add this to your .env file:");
  console.log("─".repeat(70));
  console.log(`AUTH_PASSWORD_HASH=${hash}`);
  console.log("─".repeat(70));
  console.log("\nAlso add:");
  console.log(`AUTH_USERNAME=admin`);
  console.log("\n(Change 'admin' to your desired username)\n");
}

main();
