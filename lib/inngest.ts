/**
 * Inngest Client
 * Job queue for processing lead SMS replies asynchronously
 *
 * Why Inngest?
 * - Vercel kills fire-and-forget async functions after response is sent
 * - Inngest provides proper job queue with no timeout limits
 * - Handles retries, monitoring, and error handling automatically
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "inspired-mortgage",
  name: "Inspired Mortgage Holly",
});
