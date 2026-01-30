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
import {
  processLeadReply,
  emailFollowUpDay3,
  emailFollowUpDay7,
  smsFollowUpDay2,
  smsFollowUpDay5,
  smsFollowUpDay10,
} from "./functions";

// Inngest serve() automatically reads INNGEST_SIGNING_KEY from environment
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processLeadReply, // Our worker function for SMS replies
    // Post-call email sequence (automated drip)
    emailFollowUpDay3,
    emailFollowUpDay7,
    // Post-call SMS sequence (automated drip)
    smsFollowUpDay2,
    smsFollowUpDay5,
    smsFollowUpDay10,
  ],
});
