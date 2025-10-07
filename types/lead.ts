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
  { id: "NEW", label: "New Lead", color: "bg-[#625FFF]" }, // Bold purple - new opportunities
  { id: "CONTACTED", label: "Contacted", color: "bg-[#8B88FF]" }, // Lighter purple - initial engagement
  { id: "ENGAGED", label: "Engaged", color: "bg-[#FFB6E1]" }, // Bright pink - active conversation
  { id: "NURTURING", label: "Nurturing", color: "bg-[#E0BBE4]" }, // Soft lavender - long-term nurture
  { id: "CALL_SCHEDULED", label: "Call Scheduled", color: "bg-[#D9F36E]" }, // Lime - action pending
  { id: "CALL_COMPLETED", label: "Call Completed", color: "bg-[#B8E986]" }, // Olive green - action complete
  { id: "CONVERTED", label: "Converted", color: "bg-[#A8D96E]" }, // Success green - won
  { id: "LOST", label: "Lost", color: "bg-[#55514D]" }, // Gray - closed lost
];
