export const LEAD_DETAIL_TABS = [
  "overview",
  "communication",
  "activity",
  "reports",
] as const;

export type LeadDetailTab = (typeof LEAD_DETAIL_TABS)[number];

const COMMUNICATION_ACTIVITY_TYPES = new Set([
  "SMS_SENT",
  "SMS_RECEIVED",
  "EMAIL_SENT",
  "EMAIL_RECEIVED",
  "CALL_COMPLETED",
]);

const ACTIVITY_ACTIVITY_TYPES = new Set([
  "STATUS_CHANGE",
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_CANCELLED",
  "NOTE_ADDED",
  "CALL_OUTCOME_LOGGED",
  "APPOINTMENT_NO_SHOW",
]);

export function normalizeLeadDetailTab(
  value: string | null | undefined
): LeadDetailTab {
  if (value && LEAD_DETAIL_TABS.includes(value as LeadDetailTab)) {
    return value as LeadDetailTab;
  }

  return "overview";
}

export function getLeadDetailTabForActivityType(
  activityType: string | null | undefined
): LeadDetailTab {
  if (!activityType) {
    return "overview";
  }

  if (COMMUNICATION_ACTIVITY_TYPES.has(activityType)) {
    return "communication";
  }

  if (ACTIVITY_ACTIVITY_TYPES.has(activityType)) {
    return "activity";
  }

  return "overview";
}

export function buildLeadDetailHref(
  leadId: string,
  tab?: LeadDetailTab
): string {
  const search = new URLSearchParams({ lead: leadId });

  if (tab && tab !== "overview") {
    search.set("tab", tab);
  }

  return `/dashboard?${search.toString()}`;
}
