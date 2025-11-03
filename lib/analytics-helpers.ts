/**
 * Analytics Helper Library
 *
 * Standardized calculations for all analytics metrics.
 * This is the SINGLE SOURCE OF TRUTH for analytics logic.
 *
 * All analytics endpoints MUST use these helpers to ensure consistency.
 */

import { Lead, Appointment, CallOutcome, Communication } from '@prisma/client';

// Type for lead with relations
export type LeadWithRelations = Lead & {
  communications?: Communication[];
  appointments?: Appointment[];
  callOutcomes?: CallOutcome[];
};

/**
 * CONVERSION TRACKING
 * A lead is converted if BOTH conditions are met:
 * 1. status === "CONVERTED"
 * 2. convertedAt timestamp is set
 */
export function isLeadConverted(lead: Lead): boolean {
  return lead.status === 'CONVERTED' && lead.convertedAt !== null;
}

/**
 * APPLICATION TRACKING
 */
export function hasStartedApplication(lead: Lead): boolean {
  return lead.applicationStartedAt !== null;
}

export function hasCompletedApplication(lead: Lead): boolean {
  return lead.applicationCompletedAt !== null;
}

/**
 * CALL COMPLETION TRACKING
 * A call is completed if there's a CallOutcome with reached=true
 */
export function isCallCompleted(lead: LeadWithRelations): boolean {
  if (!lead.callOutcomes || lead.callOutcomes.length === 0) {
    return false;
  }
  return lead.callOutcomes.some((outcome) => outcome.reached === true);
}

/**
 * ENGAGEMENT TRACKING
 * A lead is engaged if they've sent an inbound message
 */
export function isLeadEngaged(lead: LeadWithRelations): boolean {
  if (!lead.communications || lead.communications.length === 0) {
    return false;
  }
  return lead.communications.some((comm) => comm.direction === 'INBOUND');
}

/**
 * BOOKING TRACKING
 * Different types of booking metrics
 */

// Has an ACTIVE booking (scheduled, not cancelled)
export function hasActiveBooking(lead: LeadWithRelations): boolean {
  if (!lead.appointments || lead.appointments.length === 0) {
    return false;
  }
  return lead.appointments.some(
    (appt) => appt.status === 'scheduled' && appt.scheduledFor && appt.scheduledFor > new Date()
  );
}

// Has EVER booked (including cancelled appointments)
export function hasEverBooked(lead: LeadWithRelations): boolean {
  return lead.appointments && lead.appointments.length > 0;
}

// Has booked and NOT cancelled
export function hasNonCancelledBooking(lead: LeadWithRelations): boolean {
  if (!lead.appointments || lead.appointments.length === 0) {
    return false;
  }
  return lead.appointments.some((appt) => appt.status !== 'cancelled');
}

// Direct booking (booked within 5 minutes of lead creation)
export function wasDirectBooked(lead: LeadWithRelations): boolean {
  if (!lead.appointments || lead.appointments.length === 0) {
    return false;
  }

  const firstAppointment = lead.appointments.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )[0];

  const timeDiff = firstAppointment.createdAt.getTime() - lead.createdAt.getTime();
  const wasWithin5Minutes = timeDiff < 5 * 60 * 1000;

  return wasWithin5Minutes && firstAppointment.calComBookingUid !== null;
}

/**
 * APPOINTMENT METRICS
 * For show-up rate and no-show tracking
 */

// Get past appointments (exclude cancelled and future)
export function getPastAppointments(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  return appointments.filter(
    (appt) =>
      appt.scheduledFor &&
      appt.scheduledFor < now &&
      appt.status !== 'cancelled'
  );
}

// Get appointments that were completed (lead showed up)
export function getCompletedAppointments(appointments: Appointment[]): Appointment[] {
  return appointments.filter((appt) => appt.status === 'completed');
}

// Get no-show appointments
export function getNoShowAppointments(appointments: Appointment[]): Appointment[] {
  return appointments.filter((appt) => appt.status === 'no_show');
}

// Get cancelled appointments
export function getCancelledAppointments(appointments: Appointment[]): Appointment[] {
  return appointments.filter((appt) => appt.status === 'cancelled');
}

/**
 * RATE CALCULATIONS
 * Standardized percentage calculations
 */

export function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100 * 10) / 10; // Round to 1 decimal place
}

export function calculateConversionRate(leads: Lead[]): number {
  const converted = leads.filter(isLeadConverted).length;
  return calculateRate(converted, leads.length);
}

export function calculateEngagementRate(leads: LeadWithRelations[]): number {
  const engaged = leads.filter(isLeadEngaged).length;
  return calculateRate(engaged, leads.length);
}

export function calculateBookingRate(leads: LeadWithRelations[]): number {
  // Of engaged leads, how many booked?
  const engagedLeads = leads.filter(isLeadEngaged);
  const booked = engagedLeads.filter(hasNonCancelledBooking).length;
  return calculateRate(booked, engagedLeads.length);
}

export function calculateShowUpRate(appointments: Appointment[]): number {
  const pastAppointments = getPastAppointments(appointments);
  const completedAppointments = getCompletedAppointments(pastAppointments);
  return calculateRate(completedAppointments.length, pastAppointments.length);
}

export function calculateNoShowRate(appointments: Appointment[]): number {
  const pastAppointments = getPastAppointments(appointments);
  const noShows = getNoShowAppointments(pastAppointments);
  return calculateRate(noShows.length, pastAppointments.length);
}

/**
 * COHORT FILTERING
 * Helper functions for cohort-based analytics
 */

export function filterByCohort(leads: Lead[], cohortName: string | null): Lead[] {
  if (!cohortName) return leads; // No filter
  return leads.filter((lead) => lead.cohort === cohortName);
}

export function groupByCohort(leads: Lead[]): Record<string, Lead[]> {
  return leads.reduce(
    (acc, lead) => {
      const cohort = lead.cohort || 'NO_COHORT';
      if (!acc[cohort]) {
        acc[cohort] = [];
      }
      acc[cohort].push(lead);
      return acc;
    },
    {} as Record<string, Lead[]>
  );
}

/**
 * DATE RANGE FILTERING
 */

export function filterByDateRange(
  leads: Lead[],
  startDate?: Date | null,
  endDate?: Date | null
): Lead[] {
  let filtered = leads;

  if (startDate) {
    filtered = filtered.filter((lead) => lead.createdAt >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter((lead) => lead.createdAt <= endDate);
  }

  return filtered;
}

/**
 * CANCELLATION/REBOOKING ANALYTICS
 * Track patterns in booking behavior
 */

export function getCancellationCount(lead: LeadWithRelations): number {
  if (!lead.appointments) return 0;
  return getCancelledAppointments(lead.appointments).length;
}

export function hasMultipleCancellations(lead: LeadWithRelations): boolean {
  return getCancellationCount(lead) >= 2;
}

export function hasRebooked(lead: LeadWithRelations): boolean {
  if (!lead.appointments || lead.appointments.length < 2) {
    return false;
  }

  // Check if there's a cancelled appointment followed by a new booking
  const sortedAppointments = lead.appointments.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (let i = 0; i < sortedAppointments.length - 1; i++) {
    if (sortedAppointments[i].status === 'cancelled') {
      return true; // Has a cancellation and at least one more appointment
    }
  }

  return false;
}

/**
 * FUNNEL METRICS
 * Standard conversion funnel calculations
 */

export interface FunnelMetrics {
  totalLeads: number;
  contacted: number;
  engaged: number;
  booked: number;
  callCompleted: number;
  applicationStarted: number;
  converted: number;
  dealsWon: number;
  // Rates
  contactRate: number;
  engagementRate: number;
  bookingRate: number;
  callCompletionRate: number;
  conversionRate: number;
  dealsWonRate: number;
}

export function calculateFunnelMetrics(leads: LeadWithRelations[]): FunnelMetrics {
  const totalLeads = leads.length;
  const contacted = leads.filter((l) => l.lastContactedAt !== null).length;
  const engaged = leads.filter(isLeadEngaged).length;
  const booked = leads.filter(hasNonCancelledBooking).length;
  const callCompleted = leads.filter(isCallCompleted).length;
  const applicationStarted = leads.filter(hasStartedApplication).length;
  const converted = leads.filter(isLeadConverted).length;
  const dealsWon = leads.filter((l) => l.status === 'DEALS_WON').length;

  return {
    totalLeads,
    contacted,
    engaged,
    booked,
    callCompleted,
    applicationStarted,
    converted,
    dealsWon,
    // Rates
    contactRate: calculateRate(contacted, totalLeads),
    engagementRate: calculateRate(engaged, totalLeads),
    bookingRate: calculateRate(booked, engaged), // Of engaged, how many booked
    callCompletionRate: calculateRate(callCompleted, booked), // Of booked, how many completed
    conversionRate: calculateRate(converted, totalLeads),
    dealsWonRate: calculateRate(dealsWon, converted), // Of converted, how many won
  };
}

/**
 * COHORT COMPARISON
 * Calculate metrics for multiple cohorts
 */

export interface CohortMetrics extends FunnelMetrics {
  cohortName: string;
  cohortStartDate: Date | null;
  averageDaysToConversion: number | null;
  directBookingRate: number;
}

export function calculateCohortMetrics(leads: LeadWithRelations[], cohortName: string): CohortMetrics {
  const cohortLeads = filterByCohort(leads, cohortName);
  const funnelMetrics = calculateFunnelMetrics(cohortLeads);

  // Calculate average days to conversion
  const convertedLeads = cohortLeads.filter(isLeadConverted);
  const averageDaysToConversion =
    convertedLeads.length > 0
      ? convertedLeads.reduce((sum, lead) => {
          const days = Math.floor(
            (lead.convertedAt!.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }, 0) / convertedLeads.length
      : null;

  // Direct booking rate
  const directBookings = cohortLeads.filter(wasDirectBooked).length;
  const directBookingRate = calculateRate(directBookings, cohortLeads.length);

  // Get cohort start date (should be same for all leads in cohort)
  const cohortStartDate = cohortLeads[0]?.cohortStartDate || null;

  return {
    ...funnelMetrics,
    cohortName,
    cohortStartDate,
    averageDaysToConversion,
    directBookingRate,
  };
}

/**
 * TIME-BASED COHORTS (Monthly)
 * For backwards compatibility with existing monthly grouping
 */

export function groupByMonth(leads: Lead[]): Record<string, Lead[]> {
  return leads.reduce(
    (acc, lead) => {
      const month = lead.createdAt.toISOString().slice(0, 7); // YYYY-MM format
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(lead);
      return acc;
    },
    {} as Record<string, Lead[]>
  );
}
