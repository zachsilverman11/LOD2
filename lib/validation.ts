import { z } from "zod";

// Webhook lead schema
export const webhookLeadSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  source: z.string().optional(),
  consentEmail: z.boolean().default(false),
  consentSms: z.boolean().default(false),
  consentCall: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export type WebhookLeadInput = z.infer<typeof webhookLeadSchema>;
