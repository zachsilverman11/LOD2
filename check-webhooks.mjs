import { PrismaClient } from './app/generated/prisma/index.js';

const prisma = new PrismaClient();

const webhooks = await prisma.webhookEvent.findMany({
  where: { source: 'vapi' },
  orderBy: { createdAt: 'desc' },
  take: 5
});

console.log('🔍 Vapi Webhook Events:', webhooks.length);
webhooks.forEach(w => {
  console.log(`- ${w.eventType} (${w.processed ? 'processed' : 'pending'})`);
  console.log(`  Payload:`, JSON.stringify(w.payload).substring(0, 200));
});

await prisma.$disconnect();
