/**
 * Test timezone utilities to ensure they're calculating correctly
 */

import { getLocalTime, isWithinSMSHours, getLocalTimeString, getNext8AM } from '../lib/timezone-utils';

console.log('=== TIMEZONE UTILITY TEST ===\n');

const now = new Date();
console.log(`Current UTC time: ${now.toISOString()}`);
console.log(`UTC: ${now.toUTCString()}\n`);

// Test British Columbia (Derek's timezone)
const province = 'British Columbia';
console.log(`Testing ${province}:\n`);

const bcTime = getLocalTime(province);
console.log(`getLocalTime() result:`);
console.log(`  - ISO: ${bcTime.toISOString()}`);
console.log(`  - UTC Hours: ${bcTime.getUTCHours()}`);
console.log(`  - UTC Minutes: ${bcTime.getUTCMinutes()}`);
console.log(`  - Formatted: ${getLocalTimeString(province)}\n`);

const withinHours = isWithinSMSHours(province);
console.log(`isWithinSMSHours(): ${withinHours}`);
console.log(`  - Should be true if between 8 AM - 9 PM Pacific\n`);

const next8AM = getNext8AM(province);
console.log(`getNext8AM() result:`);
console.log(`  - ISO: ${next8AM.toISOString()}`);
console.log(`  - Should be tomorrow at 8 AM Pacific if current hour >= 8 AM\n`);

// Manual calculation for verification
const utcHour = now.getUTCHours();
const utcMinute = now.getUTCMinutes();

// Pacific Time is UTC-8 (PST) or UTC-7 (PDT)
// October 29 is still in DST (ends Nov 3), so UTC-7
const pacificHour = (utcHour - 7 + 24) % 24;

console.log('=== MANUAL VERIFICATION ===\n');
console.log(`UTC Time: ${utcHour}:${utcMinute.toString().padStart(2, '0')}`);
console.log(`Pacific Time (UTC-7 for DST): ${pacificHour}:${utcMinute.toString().padStart(2, '0')}`);
console.log(`Should be within SMS hours (8-21): ${pacificHour >= 8 && pacificHour < 21}\n`);

// Check if our function matches manual calculation
const functionHour = bcTime.getUTCHours();
console.log(`Function calculated hour: ${functionHour}`);
console.log(`Manual calculated hour: ${pacificHour}`);
console.log(`Match: ${functionHour === pacificHour ? '✅' : '❌'}\n`);
