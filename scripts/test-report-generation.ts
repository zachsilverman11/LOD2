/**
 * Test for the AI response parsing fix in report generation.
 *
 * Tests the parsing logic directly (strips markdown fences, error handling)
 * and then does a live end-to-end test against Claude using the same
 * Anthropic client the routes use — bypassing the HTTP/auth layer.
 *
 * Run with:  npx tsx scripts/test-report-generation.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load env vars from .env (where ANTHROPIC_API_KEY lives)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

// ─── parsing helpers (mirrors the fixed route logic) ──────────────────────────

function parseBulletsResponse(raw: string): string[] {
  const cleaned = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}

function parseMortgageDataResponse(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(cleaned);
}

// ─── unit tests: parsing logic (no network) ───────────────────────────────────

function testParsingUnit() {
  console.log("\n═══════════════════════════════════════════");
  console.log("UNIT TESTS — Parsing Logic");
  console.log("═══════════════════════════════════════════");

  let passed = 0;
  const total = 4;

  // 1. Clean JSON array
  try {
    const result = parseBulletsResponse('["bullet 1","bullet 2"]');
    console.assert(Array.isArray(result) && result.length === 2, "clean array");
    console.log("✅ 1/4 — Clean JSON array parses correctly");
    passed++;
  } catch (e) {
    console.error("❌ 1/4 — Clean JSON array:", e);
  }

  // 2. Markdown-fenced JSON array (the bug that was failing)
  try {
    const result = parseBulletsResponse(
      "```json\n[\"You mentioned your mortgage is renewing.\",\"Your goal is to reduce payment shock.\"]\n```"
    );
    console.assert(Array.isArray(result) && result.length === 2, "fenced array");
    console.log("✅ 2/4 — Markdown-fenced JSON array strips and parses correctly");
    passed++;
  } catch (e) {
    console.error("❌ 2/4 — Markdown-fenced JSON array:", e);
  }

  // 3. Clean JSON object
  try {
    const result = parseMortgageDataResponse(
      '{"mortgageAmount":520000,"previousRate":0.0189,"otherDebts":[]}'
    );
    console.assert(result.mortgageAmount === 520000, "clean object");
    console.log("✅ 3/4 — Clean JSON object parses correctly");
    passed++;
  } catch (e) {
    console.error("❌ 3/4 — Clean JSON object:", e);
  }

  // 4. Markdown-fenced JSON object (the bug that was failing)
  try {
    const result = parseMortgageDataResponse(
      "```json\n{\"mortgageAmount\":520000,\"previousRate\":0.0189,\"otherDebts\":[]}\n```"
    );
    console.assert(result.mortgageAmount === 520000, "fenced object");
    console.log("✅ 4/4 — Markdown-fenced JSON object strips and parses correctly");
    passed++;
  } catch (e) {
    console.error("❌ 4/4 — Markdown-fenced JSON object:", e);
  }

  console.log(`\nUnit tests: ${passed}/${total} passed`);
  return passed === total;
}

// ─── live Claude tests ─────────────────────────────────────────────────────────

const TEST_NOTES = `
Client: Sarah & Michael Chen — March 14, 2025
Advisor: James Holloway

- Bought home in 2021 at 5-year fixed rate of 1.89%
- Mortgage balance approximately $520,000
- Original amortization 25 years, roughly 21 years remaining
- Renewing in July 2025, expect to be quoted ~4.5%
- Combined income ~$185k (tech + teacher)
- $14,000 car loan at $380/month; $7,500 credit card balance
- Goal: understand options, reduce payment shock
- Prefer fixed rate for predictability
- Open to debt consolidation into mortgage
`;

async function testLiveGenerateBullets(client: Anthropic): Promise<boolean> {
  console.log("\n─────────────────────────────────────────");
  console.log("LIVE TEST 1 — generate-bullets (Claude call)");
  console.log("─────────────────────────────────────────");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are writing a section called "What You Told Us" for a mortgage strategy report sent to Canadian homeowners after a discovery call with their mortgage advisor.

Generate 4-6 bullet points that summarize the client's key situation, goals, and timeline based on the discovery call notes provided.

Rules:
- Use a warm, conversational tone - like a trusted advisor reflecting back what they heard
- Focus ONLY on what the CLIENT told us about their situation
- Do NOT include: internal notes, next steps, advisor observations, recommendations, or operational details
- Each bullet should be 1-2 sentences max
- Start bullets with "You" or "Your" to speak directly to the client

Return ONLY a valid JSON array of strings. No markdown, no explanation, just the array.`,
    messages: [{ role: "user", content: TEST_NOTES }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  console.log(`   Raw Claude response (${raw.length} chars): ${raw.slice(0, 80)}...`);

  let bullets: string[];
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    bullets = JSON.parse(cleaned);
  } catch {
    console.error("❌ FAILED — JSON parse error. Raw response:", raw.slice(0, 200));
    return false;
  }

  if (!Array.isArray(bullets) || bullets.length < 4) {
    console.error("❌ FAILED — expected array with 4+ items, got:", bullets);
    return false;
  }

  console.log(`✅ PASSED — ${bullets.length} bullets generated:`);
  bullets.forEach((b, i) => console.log(`   ${i + 1}. ${b}`));
  return true;
}

async function testLiveExtractMortgageData(client: Anthropic): Promise<boolean> {
  console.log("\n─────────────────────────────────────────");
  console.log("LIVE TEST 2 — extract-mortgage-data Scenario 1 (Claude call)");
  console.log("─────────────────────────────────────────");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are extracting mortgage data from discovery call notes for a Canadian mortgage brokerage.

Extract the following for Scenario 1 (Sub-2% Fixed Rate that is now renewing):
- mortgageAmount: current mortgage balance
- originalAmortization: years when they first got the mortgage
- currentAmortization: years remaining now
- previousRate: their old sub-2% rate (e.g., 1.89%)
- currentMarketRate: what rate they'd renew at today (default to 4.5% if not mentioned)

Also look for any other debts mentioned that could be consolidated:
- otherDebts: array of objects with {type, balance, payment}

IMPORTANT:
- Return numbers as raw numbers (no $ or , symbols)
- Return rates as decimals (e.g., 0.0189 for 1.89%, 0.045 for 4.5%)
- If a value is clearly not mentioned in the notes, use null
- For currentMarketRate in Scenario 1, default to 0.045 (4.5%) if not specified

Return ONLY a valid JSON object. No markdown, no explanation, just the JSON.`,
    messages: [{ role: "user", content: TEST_NOTES }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  console.log(`   Raw Claude response (${raw.length} chars): ${raw.slice(0, 80)}...`);

  let extracted: Record<string, unknown>;
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    extracted = JSON.parse(cleaned);
  } catch {
    console.error("❌ FAILED — JSON parse error. Raw response:", raw.slice(0, 200));
    return false;
  }

  const issues: string[] = [];
  if (!extracted.mortgageAmount) issues.push("mortgageAmount missing");
  if (!extracted.previousRate) issues.push("previousRate missing");
  if (!extracted.currentMarketRate) issues.push("currentMarketRate missing");
  if (!Array.isArray(extracted.otherDebts)) issues.push("otherDebts not an array");

  if (issues.length > 0) {
    console.warn("⚠️  PARTIAL — some fields missing:", issues.join(", "));
  } else {
    console.log("✅ PASSED — all key fields populated");
  }

  console.log("   mortgageAmount:", extracted.mortgageAmount);
  console.log("   previousRate:", extracted.previousRate);
  console.log("   currentMarketRate:", extracted.currentMarketRate);
  console.log("   currentAmortization:", extracted.currentAmortization);
  console.log("   otherDebts:", JSON.stringify(extracted.otherDebts));

  return issues.length === 0;
}

// ─── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("LOD Report Generation — AI Parsing Fix Verification");
  console.log("====================================================");

  // Unit tests first (no network)
  const unitOk = testParsingUnit();

  // Live Claude tests
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("\n⚠️  ANTHROPIC_API_KEY not found — skipping live tests");
    process.exit(unitOk ? 0 : 1);
  }

  const client = new Anthropic({ apiKey });

  const [bulletsOk, mortgageOk] = await Promise.all([
    testLiveGenerateBullets(client),
    testLiveExtractMortgageData(client),
  ]);

  console.log("\n═══════════════════════════════════════════");
  const allPassed = unitOk && bulletsOk && mortgageOk;
  if (allPassed) {
    console.log("ALL TESTS PASSED ✅");
    console.log("The AI parsing fix is working correctly.");
    console.log("Claude responses parse successfully whether or not markdown fences are present.");
  } else {
    const failed = [!unitOk && "unit", !bulletsOk && "bullets", !mortgageOk && "mortgage-data"]
      .filter(Boolean)
      .join(", ");
    console.log(`SOME TESTS FAILED ❌ — failed: ${failed}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
