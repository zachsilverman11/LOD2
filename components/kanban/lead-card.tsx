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
      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-base">
            {lead.firstName} {lead.lastName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{lead.email}</p>
          {lead.phone && (
            <p className="text-sm text-gray-600">{lead.phone}</p>
          )}
        </div>
      </div>

      {nextAppointment && (
        <div className="mt-3 p-2.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <p className="text-green-700 font-semibold text-sm flex items-center gap-1">
            <span className="text-base">📅</span>
            {format(new Date(nextAppointment.scheduledAt), "MMM d, h:mm a")}
          </p>
        </div>
      )}

      {lastActivity && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
          Last activity: {format(new Date(lastActivity.createdAt), "MMM d, h:mm a")}
        </div>
      )}

      <div className="mt-3 flex gap-2 flex-wrap">
        {lead.consentEmail && (
          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium border border-blue-200">
            📧 Email
          </span>
        )}
        {lead.consentSms && (
          <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium border border-purple-200">
            💬 SMS
          </span>
        )}
        {lead.consentCall && (
          <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium border border-green-200">
            📞 Call
          </span>
        )}
      </div>
    </div>
  );
}
