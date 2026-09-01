import { config } from "dotenv";
import { verifyCredentials } from "../lib/auth-simple";

config();

async function testAuth() {
  console.log("🧪 Testing authentication...\n");
  console.log("AUTH_USERNAME:", process.env.AUTH_USERNAME);
  console.log("AUTH_PASSWORD_HASH:", process.env.AUTH_PASSWORD_HASH);
  console.log();

  const username = "admin";
  const password = process.env.AUTH_TEST_PASSWORD;

  if (!password) {
    throw new Error(
      'AUTH_TEST_PASSWORD is not set. It must contain the plaintext app login password to check against AUTH_PASSWORD_HASH.'
    );
  }

  console.log(`Testing credentials: ${username} / ${password}`);

  const isValid = await verifyCredentials(username, password);

  if (isValid) {
    console.log("✅ Credentials are VALID");
  } else {
    console.log("❌ Credentials are INVALID");
    console.log("\nDebugging:");

    // Hash the password manually to see what we get
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    console.log("Generated hash:", hash);
    console.log("Expected hash: ", process.env.AUTH_PASSWORD_HASH);
    console.log("Match:", hash === process.env.AUTH_PASSWORD_HASH);
  }
}

testAuth();
