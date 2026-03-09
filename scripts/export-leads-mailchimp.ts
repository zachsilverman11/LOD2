import { PrismaClient } from '../app/generated/prisma';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

function cleanPhone(phone: string | null): string {
  if (!phone) return '';
  // Strip to digits only
  const digits = phone.replace(/\D/g, '');
  // Handle North American numbers (10 or 11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  // For other lengths, just prefix with + if we have digits
  return digits.length > 0 ? `+${digits}` : '';
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main() {
  console.log('Fetching all leads from database...\n');

  const leads = await prisma.lead.findMany({
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total leads queried: ${leads.length}`);

  // Deduplicate by email (keep most recent — already sorted desc by createdAt)
  const seen = new Set<string>();
  const deduplicated: typeof leads = [];
  let duplicateCount = 0;

  for (const lead of leads) {
    const emailLower = lead.email.toLowerCase().trim();
    if (seen.has(emailLower)) {
      duplicateCount++;
      continue;
    }
    seen.add(emailLower);
    deduplicated.push(lead);
  }

  // Filter out leads with no/empty email (shouldn't happen since email is required, but be safe)
  let noEmailCount = 0;
  const exportable = deduplicated.filter((lead) => {
    if (!lead.email || !lead.email.trim()) {
      noEmailCount++;
      return false;
    }
    return true;
  });

  // Build CSV
  const header = 'Email Address,First Name,Last Name,Phone';
  const rows = exportable.map((lead) =>
    [
      escapeCsvField(lead.email.trim()),
      escapeCsvField((lead.firstName || '').trim()),
      escapeCsvField((lead.lastName || '').trim()),
      escapeCsvField(cleanPhone(lead.phone)),
    ].join(',')
  );

  const csv = [header, ...rows].join('\n') + '\n';
  const outPath = resolve(__dirname, '..', 'mailchimp-export.csv');
  writeFileSync(outPath, csv, 'utf-8');

  // Summary
  console.log(`\n--- Export Summary ---`);
  console.log(`Total leads in database:  ${leads.length}`);
  console.log(`Duplicates removed:       ${duplicateCount}`);
  console.log(`Skipped (no email):       ${noEmailCount}`);
  console.log(`Total exported:           ${exportable.length}`);
  console.log(`\nCSV saved to: ${outPath}`);
}

main()
  .catch((err) => {
    console.error('Export failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
