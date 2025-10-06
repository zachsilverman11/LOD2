import { Lead, LeadActivity, Appointment, Communication, LeadStatus } from "@/app/generated/prisma";

export type LeadWithRelations = Lead & {
  activities: LeadActivity[];
  appointments: Appointment[];
  communications: Communication[];
};

export const PIPELINE_STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: "NEW", label: "New Lead", color: "bg-blue-600" },
  { id: "CONTACTED", label: "Contacted", color: "bg-orange-500" },
  { id: "QUALIFIED", label: "Qualified", color: "bg-purple-600" },
  { id: "CALL_SCHEDULED", label: "Call Scheduled", color: "bg-green-600" },
  { id: "CALL_COMPLETED", label: "Call Completed", color: "bg-teal-600" },
  { id: "CONVERTED", label: "Converted", color: "bg-emerald-600" },
  { id: "LOST", label: "Lost", color: "bg-slate-600" },
];
