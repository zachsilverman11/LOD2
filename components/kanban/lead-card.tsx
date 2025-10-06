"use client";

import { LeadWithRelations } from "@/types/lead";
import { format } from "date-fns";

interface LeadCardProps {
  lead: LeadWithRelations;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const lastActivity = lead.activities[0];
  const nextAppointment = lead.appointments.find(a => a.status === "scheduled");

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow-sm border border-[#E4DDD3] cursor-pointer hover:shadow-lg hover:border-[#625FFF] transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-[#1C1B1A] text-base">
            {lead.firstName} {lead.lastName}
          </h3>
          <p className="text-sm text-[#55514D] mt-1">{lead.email}</p>
          {lead.phone && (
            <p className="text-sm text-[#55514D]">{lead.phone}</p>
          )}
        </div>
      </div>

      {nextAppointment && (
        <div className="mt-3 p-2.5 bg-[#D9F36E]/20 rounded border border-[#D9F36E]">
          <p className="text-[#1C1B1A] font-medium text-sm">
            {format(new Date(nextAppointment.scheduledAt), "MMM d, h:mm a")}
          </p>
        </div>
      )}

      {lastActivity && (
        <div className="mt-3 text-xs text-[#55514D] flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[#B1AFFF] rounded-full"></span>
          Last activity: {format(new Date(lastActivity.createdAt), "MMM d, h:mm a")}
        </div>
      )}

      <div className="mt-3 flex gap-2 flex-wrap">
        {lead.consentEmail && (
          <span className="text-xs bg-[#625FFF]/10 text-[#625FFF] px-2.5 py-1 rounded font-medium border border-[#625FFF]/30">
            Email
          </span>
        )}
        {lead.consentSms && (
          <span className="text-xs bg-[#B1AFFF]/30 text-[#625FFF] px-2.5 py-1 rounded font-medium border border-[#B1AFFF]">
            SMS
          </span>
        )}
        {lead.consentCall && (
          <span className="text-xs bg-[#D9F36E]/30 text-[#1C1B1A] px-2.5 py-1 rounded font-medium border border-[#D9F36E]">
            Call
          </span>
        )}
      </div>
    </div>
  );
}
