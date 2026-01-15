import { Lead, LeadActivity, Appointment, Communication, LeadStatus, Note, Task, CallOutcome } from "@/app/generated/prisma";

export type LeadWithRelations = Lead & {
  activities: LeadActivity[];
  appointments: Appointment[];
  communications: Communication[];
  notes: Note[];
  tasks: Task[];
  callOutcomes: CallOutcome[];
};

export const TEAM_MEMBERS = ["Greg", "Jakub", "Admin Team"] as const;
export type TeamMember = typeof TEAM_MEMBERS[number];

export const PIPELINE_STAGES: {
  id: LeadStatus;
  label: string;
  bgColor: string;
  textColor: string;
  headerBg: string;
  borderColor: string;
}[] = [
  {
    id: "NEW",
    label: "New Lead",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
    headerBg: "bg-slate-100",
    borderColor: "border-slate-200"
  },
  {
    id: "CONTACTED",
    label: "Contacted",
    bgColor: "bg-[#625FFF]/5",
    textColor: "text-[#625FFF]",
    headerBg: "bg-[#625FFF]/10",
    borderColor: "border-[#625FFF]/20"
  },
  {
    id: "ENGAGED",
    label: "Engaged",
    bgColor: "bg-pink-50/50",
    textColor: "text-pink-700",
    headerBg: "bg-pink-50",
    borderColor: "border-pink-200"
  },
  {
    id: "CALL_SCHEDULED",
    label: "Call Booked",
    bgColor: "bg-amber-50/50",
    textColor: "text-amber-700",
    headerBg: "bg-amber-50",
    borderColor: "border-amber-200"
  },
  {
    id: "WAITING_FOR_APPLICATION",
    label: "Awaiting App",
    bgColor: "bg-lime-50/50",
    textColor: "text-lime-700",
    headerBg: "bg-lime-50",
    borderColor: "border-lime-200"
  },
  {
    id: "APPLICATION_STARTED",
    label: "App Started",
    bgColor: "bg-emerald-50/50",
    textColor: "text-emerald-700",
    headerBg: "bg-emerald-50",
    borderColor: "border-emerald-200"
  },
  {
    id: "CONVERTED",
    label: "Converted",
    bgColor: "bg-green-50/50",
    textColor: "text-green-700",
    headerBg: "bg-green-100",
    borderColor: "border-green-200"
  },
  {
    id: "DEALS_WON",
    label: "Deals Won",
    bgColor: "bg-green-100/50",
    textColor: "text-green-800",
    headerBg: "bg-green-100",
    borderColor: "border-green-300"
  },
  {
    id: "NURTURING",
    label: "Nurturing",
    bgColor: "bg-violet-50/50",
    textColor: "text-violet-700",
    headerBg: "bg-violet-50",
    borderColor: "border-violet-200"
  },
  {
    id: "LOST",
    label: "Lost",
    bgColor: "bg-gray-50/50",
    textColor: "text-gray-500",
    headerBg: "bg-gray-100",
    borderColor: "border-gray-200"
  },
];
