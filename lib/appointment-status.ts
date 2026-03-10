export const ACTIVE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "SCHEDULED",
  "CONFIRMED",
] as const;

export function isActiveAppointmentStatus(status?: string | null): boolean {
  return typeof status === "string" && ["scheduled", "confirmed"].includes(status.toLowerCase());
}
