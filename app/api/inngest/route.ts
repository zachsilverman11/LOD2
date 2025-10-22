/**
 * Inngest Serve Endpoint
 * This endpoint allows Inngest to communicate with our worker functions
 *
 * Inngest will:
 * - Register our functions on deployment
 * - Trigger functions when events are sent
 * - Monitor execution and handle retries
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processLeadReply } from "./functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processLeadReply, // Our worker function for SMS replies
  ],
});
