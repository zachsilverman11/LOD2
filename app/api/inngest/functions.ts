/**
 * Inngest Worker Functions
 * Processes lead SMS replies asynchronously using job queue
 */

import { inngest } from "@/lib/inngest";
import { processLeadWithAutonomousAgent } from "@/lib/autonomous-agent";
import { sendErrorAlert } from "@/lib/slack";

/**
 * Process Lead SMS Reply
 *
 * Triggered when a lead replies to an SMS
 * Runs Holly's autonomous agent to analyze and respond
 */
export const processLeadReply = inngest.createFunction(
  {
    id: "process-lead-reply",
    name: "Process Lead SMS Reply with Autonomous Holly",
    retries: 2, // Auto-retry on failure
    rateLimit: {
      limit: 10,
      period: "1m", // Max 10 concurrent leads (prevents Claude API rate limits)
    },
  },
  { event: "lead/reply" },
  async ({ event, step }) => {
    const { leadId, message, phone } = event.data;

    console.log(`[Inngest Worker] Processing lead reply: ${leadId}`);

    // Step 1: Process with Autonomous Holly Agent
    const result = await step.run("process-with-autonomous-holly", async () => {
      try {
        return await processLeadWithAutonomousAgent(leadId);
      } catch (error) {
        console.error(`[Inngest Worker] Error processing lead ${leadId}:`, error);
        throw error; // Re-throw so Inngest retries
      }
    });

    // Step 2: Handle result
    if (result.success) {
      console.log(`[Inngest Worker] ✅ Success: ${leadId} → ${result.action}`);
      return {
        success: true,
        action: result.action,
        message: result.message,
      };
    } else {
      console.log(`[Inngest Worker] ⏭️  Deferred: ${leadId} → ${result.reason}`);

      // Only send error alert if it's an actual error (not just "wait" decision)
      const isError =
        result.reason &&
        !result.reason.toLowerCase().includes("wait") &&
        !result.reason.toLowerCase().includes("blocked") &&
        !result.reason.toLowerCase().includes("disabled");

      if (isError) {
        await sendErrorAlert({
          error: new Error(result.reason || "Unknown error"),
          context: {
            location: "Inngest Worker - process-lead-reply",
            leadId,
            details: { message, phone, reason: result.reason },
          },
        });
      }

      return {
        success: false,
        reason: result.reason,
      };
    }
  }
);
