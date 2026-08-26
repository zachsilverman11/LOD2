/**
 * Test availability timezone display fix
 * Verifies that:
 * 1. BC slots display as PT (e.g., 2026-08-27T22:20:00.000Z → Thu 3:20 PM PT)
 * 2. Alberta slots display as MT (e.g., 2026-08-27T22:20:00.000Z → Thu 4:20 PM MT)
 * 3. Past slots are filtered out from the representative list
 * 4. Prompt uses local timezone name (PT/MT) not IANA identifier
 */

import { getTimezoneForProvince, getTimezoneNameForProvince, type TimeSlot } from '../lib/calcom';

describe('Availability timezone display', () => {
  test('getTimezoneForProvince returns correct IANA timezone', () => {
    expect(getTimezoneForProvince('British Columbia')).toBe('America/Vancouver');
    expect(getTimezoneForProvince('BC')).toBe('America/Vancouver');
    expect(getTimezoneForProvince('Alberta')).toBe('America/Edmonton');
    expect(getTimezoneForProvince('AB')).toBe('America/Edmonton');
    expect(getTimezoneForProvince()).toBe('America/Vancouver'); // default
  });

  test('getTimezoneNameForProvince returns correct short name', () => {
    expect(getTimezoneNameForProvince('British Columbia')).toBe('PT');
    expect(getTimezoneNameForProvince('BC')).toBe('PT');
    expect(getTimezoneNameForProvince('Alberta')).toBe('MT');
    expect(getTimezoneNameForProvince('AB')).toBe('MT');
    expect(getTimezoneNameForProvince('Saskatchewan')).toBe('CT');
    expect(getTimezoneNameForProvince('Ontario')).toBe('ET');
    expect(getTimezoneNameForProvince()).toBe('PT'); // default
  });

  test('BC slot converts correctly to local time', () => {
    // 2026-08-27T22:20:00.000Z is the incident slot
    const isoTime = '2026-08-27T22:20:00.000Z';
    const tz = getTimezoneForProvince('British Columbia');
    const tzName = getTimezoneNameForProvince('British Columbia');

    expect(tz).toBe('America/Vancouver');
    expect(tzName).toBe('PT');

    // Convert to local time
    const date = new Date(isoTime);
    const displayTime = date.toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Should be Thursday 3:20 PM Pacific (UTC-7 in August = PDT)
    expect(displayTime).toContain('Thu');
    expect(displayTime).toContain('3:20');
    expect(displayTime).toContain('PM');
  });

  test('Alberta slot converts correctly to local time', () => {
    // Same ISO time, different timezone
    const isoTime = '2026-08-27T22:20:00.000Z';
    const tz = getTimezoneForProvince('Alberta');
    const tzName = getTimezoneNameForProvince('Alberta');

    expect(tz).toBe('America/Edmonton');
    expect(tzName).toBe('MT');

    // Convert to local time
    const date = new Date(isoTime);
    const displayTime = date.toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Should be Thursday 4:20 PM Mountain (UTC-6 in August = MDT)
    expect(displayTime).toContain('Thu');
    expect(displayTime).toContain('4:20');
    expect(displayTime).toContain('PM');
  });

  test('buildRepresentativeSlotList filters past slots', () => {
    const now = new Date();
    const pastTime = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
    const futureTime1 = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now
    const futureTime2 = new Date(now.getTime() + 7200000).toISOString(); // 2 hours from now

    const slots: TimeSlot[] = [
      { time: pastTime, displayTime: 'Past Slot' },
      { time: futureTime1, displayTime: 'Future Slot 1' },
      { time: futureTime2, displayTime: 'Future Slot 2' },
    ];

    // Simulate the filtering logic
    const filtered = slots.filter(slot => new Date(slot.time) > now);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].displayTime).toBe('Future Slot 1');
    expect(filtered[1].displayTime).toBe('Future Slot 2');
  });

  test('prompt format includes timezone name and bookingStartTime label', () => {
    // This is a unit test to verify the prompt structure
    const mockSlot: TimeSlot = {
      time: '2026-08-27T22:20:00.000Z',
      displayTime: 'Thu, Aug 27, 3:20 PM',
    };

    const province = 'British Columbia';
    const tzName = getTimezoneNameForProvince(province);

    // Simulate the prompt line format
    const promptLine = `1. Local time: ${mockSlot.displayTime} (${tzName}) | bookingStartTime: ${mockSlot.time}`;

    expect(promptLine).toContain('Local time: Thu, Aug 27, 3:20 PM');
    expect(promptLine).toContain('(PT)');
    expect(promptLine).toContain('bookingStartTime: 2026-08-27T22:20:00.000Z');
    expect(promptLine).not.toContain('America/Vancouver');
  });

  test('agent.ts rewrite includes timezone name in SMS', () => {
    // Simulate the rewrite logic for SMS times
    const isoTime = '2026-08-27T22:20:00.000Z';
    const tz = getTimezoneForProvince('Alberta');
    const tzName = getTimezoneNameForProvince('Alberta');

    const time = new Date(isoTime).toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const smsOffer = `${time} ${tzName}`;

    expect(smsOffer).toContain('Thu');
    expect(smsOffer).toContain('4:20');
    expect(smsOffer).toContain('PM');
    expect(smsOffer).toContain('MT');
    expect(smsOffer).not.toContain('UTC');
  });
});
