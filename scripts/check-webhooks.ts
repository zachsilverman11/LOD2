import { prisma } from '../lib/db';

async function main() {
  const webhooks = await prisma.webhookEvent.findMany({
    where: { source: 'vapi' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log(`Found ${webhooks.length} webhook events:`);
  webhooks.forEach(webhook => {
    console.log(`\n${webhook.eventType} at ${webhook.createdAt}`);
    console.log('Payload:', JSON.stringify(webhook.payload, null, 2));
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
