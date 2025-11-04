/**
 * Analytics Data Validation and Correction Script
 *
 * This script identifies and fixes data inconsistencies that cause analytics inaccuracies:
 * 1. Conversion status mismatches (status vs timestamp)
 * 2. Call completion validation
 * 3. Appointment time field issues
 * 4. Timestamp consistency checks
 *
 * Features:
 * - DRY RUN mode by default (shows what would be fixed)
 * - Requires --fix flag to actually make changes
 * - Creates backup before any modifications
 * - Full audit log of all changes
 */

import { PrismaClient } from '../app/generated/prisma';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ValidationIssue {
  leadId: string;
  leadEmail: string;
  issueType: string;
  description: string;
  currentState: any;
  suggestedFix: any;
}

const issues: ValidationIssue[] = [];

async function validateConversionStatus() {
  console.log('\n🔍 Validating Conversion Status Consistency...');

  // Issue 1: Leads with CONVERTED status but no convertedAt timestamp
  const convertedWithoutTimestamp = await prisma.lead.findMany({
    where: {
      status: 'CONVERTED',
      convertedAt: null,
    },
    select: {
      id: true,
      email: true,
      status: true,
      convertedAt: true,
      applicationCompletedAt: true,
      updatedAt: true,
    },
  });

  convertedWithoutTimestamp.forEach((lead) => {
    issues.push({
      leadId: lead.id,
      leadEmail: lead.email,
      issueType: 'CONVERSION_STATUS_MISMATCH',
      description: 'Lead has status=CONVERTED but convertedAt is null',
      currentState: { status: lead.status, convertedAt: lead.convertedAt },
      suggestedFix: {
        convertedAt: lead.applicationCompletedAt || lead.updatedAt, // Use app completion or last update
      },
    });
  });

  // Issue 2: Leads with convertedAt timestamp but status is not CONVERTED
  const timestampWithoutStatus = await prisma.lead.findMany({
    where: {
      convertedAt: { not: null },
      status: { not: 'CONVERTED' },
    },
    select: {
      id: true,
      email: true,
      status: true,
      convertedAt: true,
    },
  });

  timestampWithoutStatus.forEach((lead) => {
    issues.push({
      leadId: lead.id,
      leadEmail: lead.email,
      issueType: 'CONVERSION_STATUS_MISMATCH',
      description: 'Lead has convertedAt timestamp but status is not CONVERTED',
      currentState: { status: lead.status, convertedAt: lead.convertedAt },
      suggestedFix: {
        status: 'CONVERTED',
      },
    });
  });

  console.log(
    `   Found ${convertedWithoutTimestamp.length + timestampWithoutStatus.length} conversion status issues`
  );
}

async function validateCallCompletionData() {
  console.log('\n🔍 Validating Call Completion Data...');

  // Issue: Leads with WAITING_FOR_APPLICATION status but no CallOutcome with reached=true
  const callCompletedNoOutcome = await prisma.lead.findMany({
    where: {
      status: 'WAITING_FOR_APPLICATION',
    },
    include: {
      callOutcomes: true,
    },
  });

  callCompletedNoOutcome.forEach((lead) => {
    const hasReachedOutcome = lead.callOutcomes!.some((outcome) => outcome.reached === true);

    if (!hasReachedOutcome) {
      issues.push({
        leadId: lead.id,
        leadEmail: lead.email,
        issueType: 'CALL_COMPLETION_MISMATCH',
        description: 'Lead has status=WAITING_FOR_APPLICATION but no CallOutcome with reached=true',
        currentState: {
          status: lead.status,
          callOutcomesCount: lead.callOutcomes!.length,
        },
        suggestedFix: {
          status: 'CALL_SCHEDULED', // Revert to scheduled if no outcome logged
        },
      });
    }
  });

  console.log(
    `   Found ${callCompletedNoOutcome.filter((l) => !l.callOutcomes!.some((o: any) => o.reached)).length} call completion issues`
  );
}

async function validateAppointmentTimes() {
  console.log('\n🔍 Validating Appointment Time Fields...');

  // Issue: Appointments with scheduledAt but no scheduledFor
  const appointmentsNoScheduledFor = await prisma.appointment.findMany({
    where: {
      scheduledFor: null,
    },
    include: {
      lead: {
        select: {
          email: true,
        },
      },
    },
  });

  appointmentsNoScheduledFor.forEach((appt) => {
    issues.push({
      leadId: appt.leadId,
      leadEmail: appt.lead.email,
      issueType: 'APPOINTMENT_TIME_MISSING',
      description: 'Appointment has scheduledAt but scheduledFor is null',
      currentState: {
        appointmentId: appt.id,
        scheduledAt: appt.scheduledAt,
        scheduledFor: appt.scheduledFor,
      },
      suggestedFix: {
        scheduledFor: appt.scheduledAt, // Copy scheduledAt to scheduledFor for backwards compatibility
      },
    });
  });

  console.log(`   Found ${appointmentsNoScheduledFor.length} appointment time issues`);
}

async function validateTimestampConsistency() {
  console.log('\n🔍 Validating Timestamp Consistency...');

  // Issue: applicationCompletedAt before applicationStartedAt
  const invalidApplicationTimestamps = await prisma.lead.findMany({
    where: {
      AND: [
        { applicationStartedAt: { not: null } },
        { applicationCompletedAt: { not: null } },
      ],
    },
    select: {
      id: true,
      email: true,
      applicationStartedAt: true,
      applicationCompletedAt: true,
    },
  });

  invalidApplicationTimestamps.forEach((lead) => {
    if (
      lead.applicationStartedAt &&
      lead.applicationCompletedAt &&
      lead.applicationCompletedAt < lead.applicationStartedAt
    ) {
      issues.push({
        leadId: lead.id,
        leadEmail: lead.email,
        issueType: 'TIMESTAMP_INCONSISTENCY',
        description: 'applicationCompletedAt is before applicationStartedAt',
        currentState: {
          applicationStartedAt: lead.applicationStartedAt,
          applicationCompletedAt: lead.applicationCompletedAt,
        },
        suggestedFix: {
          // Swap them or use completedAt for both
          applicationStartedAt: lead.applicationCompletedAt,
        },
      });
    }
  });

  console.log(`   Found ${invalidApplicationTimestamps.filter((l) => l.applicationCompletedAt! < l.applicationStartedAt!).length} timestamp consistency issues`);
}

async function createBackup() {
  console.log('\n💾 Creating backup before making changes...');

  const backup = {
    timestamp: new Date().toISOString(),
    leads: await prisma.lead.findMany(),
    appointments: await prisma.appointment.findMany(),
    callOutcomes: await prisma.callOutcome.findMany(),
  };

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `analytics-data-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

  console.log(`✅ Backup created: ${backupFile}`);
  return backupFile;
}

async function applyFixes() {
  console.log('\n🔧 Applying Fixes...\n');

  const changeLog: any[] = [];

  for (const issue of issues) {
    try {
      let result;

      switch (issue.issueType) {
        case 'CONVERSION_STATUS_MISMATCH':
          if (issue.suggestedFix.convertedAt) {
            result = await prisma.lead.update({
              where: { id: issue.leadId },
              data: { convertedAt: issue.suggestedFix.convertedAt },
            });
          } else if (issue.suggestedFix.status) {
            result = await prisma.lead.update({
              where: { id: issue.leadId },
              data: { status: issue.suggestedFix.status },
            });
          }
          break;

        case 'CALL_COMPLETION_MISMATCH':
          result = await prisma.lead.update({
            where: { id: issue.leadId },
            data: { status: issue.suggestedFix.status },
          });
          break;

        case 'APPOINTMENT_TIME_MISSING':
          result = await prisma.appointment.update({
            where: { id: issue.currentState.appointmentId },
            data: { scheduledFor: issue.suggestedFix.scheduledFor },
          });
          break;

        case 'TIMESTAMP_INCONSISTENCY':
          result = await prisma.lead.update({
            where: { id: issue.leadId },
            data: { applicationStartedAt: issue.suggestedFix.applicationStartedAt },
          });
          break;
      }

      changeLog.push({
        leadId: issue.leadId,
        leadEmail: issue.leadEmail,
        issueType: issue.issueType,
        description: issue.description,
        applied: true,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ Fixed: ${issue.issueType} for ${issue.leadEmail}`);
    } catch (error) {
      console.error(`❌ Error fixing ${issue.issueType} for ${issue.leadEmail}:`, error);
      changeLog.push({
        leadId: issue.leadId,
        leadEmail: issue.leadEmail,
        issueType: issue.issueType,
        error: error instanceof Error ? error.message : 'Unknown error',
        applied: false,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Save change log
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `analytics-fixes-${Date.now()}.json`);
  fs.writeFileSync(logFile, JSON.stringify(changeLog, null, 2));

  console.log(`\n📝 Change log saved: ${logFile}`);
}

async function main() {
  const isDryRun = !process.argv.includes('--fix');

  console.log('🚀 Analytics Data Validation & Correction\n');
  console.log('='.repeat(80));

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Run with --fix flag to apply corrections');
  } else {
    console.log('⚠️  FIX MODE - Changes will be applied to database');
  }

  console.log('='.repeat(80));

  // Run all validations
  await validateConversionStatus();
  await validateCallCompletionData();
  await validateAppointmentTimes();
  await validateTimestampConsistency();

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));

  const issuesByType = issues.reduce(
    (acc, issue) => {
      acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`\nTotal Issues Found: ${issues.length}\n`);

  Object.entries(issuesByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  if (issues.length === 0) {
    console.log('\n✅ No data issues found! Analytics data is clean.\n');
    return;
  }

  // Show sample issues
  console.log('\n📋 Sample Issues (first 5):');
  issues.slice(0, 5).forEach((issue, i) => {
    console.log(`\n${i + 1}. ${issue.issueType}`);
    console.log(`   Lead: ${issue.leadEmail}`);
    console.log(`   Issue: ${issue.description}`);
    console.log(`   Current: ${JSON.stringify(issue.currentState)}`);
    console.log(`   Fix: ${JSON.stringify(issue.suggestedFix)}`);
  });

  if (isDryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('✅ DRY RUN COMPLETE');
    console.log('='.repeat(80));
    console.log('\nTo apply these fixes, run:');
    console.log('  npx tsx scripts/validate-and-fix-analytics-data.ts --fix\n');
  } else {
    // Create backup
    const backupFile = await createBackup();

    // Apply fixes
    await applyFixes();

    console.log('\n' + '='.repeat(80));
    console.log('✅ FIXES APPLIED');
    console.log('='.repeat(80));
    console.log(`\nBackup saved: ${backupFile}`);
    console.log('All changes have been logged.\n');
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
