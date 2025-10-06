import { Lead, LeadActivity, Appointment, Communication, LeadStatus, Note, Task } from "@/app/generated/prisma";

export type LeadWithRelations = Lead & {
  activities: LeadActivity[];
  appointments: Appointment[];
  communications: Communication[];
  notes: Note[];
  tasks: Task[];
};

export const TEAM_MEMBERS = ["Greg", "Jakub", "Admin Team"] as const;
export type TeamMember = typeof TEAM_MEMBERS[number];

export const PIPELINE_STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: "NEW", label: "New Lead", color: "bg-[#625FFF]" }, // FUTURE - primary brand color
  { id: "CONTACTED", label: "Contacted", color: "bg-[#B1AFFF]" }, // LOFT - light purple accent
  { id: "ENGAGED", label: "Engaged", color: "bg-[#F6D7FF]" }, // BLOSSOM - pink accent
  { id: "NURTURING", label: "Nurturing", color: "bg-[#F6D7FF]" }, // BLOSSOM - pink accent (nurturing stage)
  { id: "CALL_SCHEDULED", label: "Call Scheduled", color: "bg-[#D9F36E]" }, // UPLIFT - lime green accent
  { id: "CALL_COMPLETED", label: "Call Completed", color: "bg-[#625FFF]" }, // FUTURE - reuse primary
  { id: "CONVERTED", label: "Converted", color: "bg-[#D9F36E]" }, // UPLIFT - success green
  { id: "LOST", label: "Lost", color: "bg-[#55514D]" }, // HORIZON - neutral gray
];
