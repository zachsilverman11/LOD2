"use client";

import { LeadWithRelations } from "@/types/lead";
import { formatDistanceToNow, isToday, differenceInDays } from "date-fns";

interface LeadCardProps {
  lead: LeadWithRelations;
  onClick: (e?: React.MouseEvent) => void;
  isSelected?: boolean;
}

export function LeadCard({ lead, onClick, isSelected }: LeadCardProps) {
  const lastActivity = lead.activities[0];

  // Check for appointment TODAY
  const appointmentToday = lead.appointments.find(
    (a) => a.status === "scheduled" && a.scheduledAt && isToday(new Date(a.scheduledAt))
  );
  const hasScheduledAppointment = lead.appointments.some(
    (a) => a.status === "scheduled"
  );

  // Check if Holly automation is active (not disabled)
  const isHollyActive = !lead.hollyDisabled;

  // Check if lead is stale (no activity in 5+ days)
  const lastActivityDate = lastActivity
    ? new Date(lastActivity.createdAt)
    : new Date(lead.createdAt);
  const daysSinceActivity = differenceInDays(new Date(), lastActivityDate);
  const isStale = daysSinceActivity >= 5;

  // Format relative time
  const getRelativeTime = () => {
    if (lastActivity) {
      return formatDistanceToNow(new Date(lastActivity.createdAt), {
        addSuffix: false,
      });
    }
    return formatDistanceToNow(new Date(lead.createdAt), { addSuffix: false });
  };

  // Determine left border accent
  const getLeftBorderClass = () => {
    if (isSelected) return "border-l-[3px] border-l-[#625FFF]";
    if (appointmentToday) return "border-l-[3px] border-l-amber-400";
    return "";
  };

  return (
    <div
      onClick={onClick}
      className={`group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-[#E5E0D8] dark:border-gray-700 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-[#625FFF]/30 dark:hover:border-[#625FFF]/50 hover:-translate-y-0.5 hover:scale-[1.01] relative ${getLeftBorderClass()} ${
        isStale && !isSelected ? "bg-orange-50/30 dark:bg-orange-900/10" : ""
      } ${isSelected ? "ring-2 ring-[#625FFF]/20 shadow-md" : ""}`}
    >
      {/* Drag Handle - appears on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg
          className="w-4 h-4 text-[#8E8983] dark:text-gray-500"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Top Row: Name + Holly Status */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-medium text-[#1C1B1A] dark:text-gray-100 text-sm truncate pr-6">
          {lead.firstName} {lead.lastName}
        </h3>
        {/* Holly Status Dot with Tooltip */}
        <div className="relative group/holly">
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
              isHollyActive
                ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                : "bg-amber-400 shadow-sm shadow-amber-400/50"
            }`}
          />
          {/* Tooltip */}
          <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-[#1C1B1A] dark:bg-gray-700 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/holly:opacity-100 transition-opacity pointer-events-none z-10">
            {isHollyActive ? "Holly active" : "Holly paused"}
          </div>
        </div>
      </div>

      {/* Middle: Email */}
      <p className="text-xs text-[#8E8983] dark:text-gray-400 truncate mb-3">{lead.email}</p>

      {/* Bottom Row: Timestamp + Indicators */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs ${isStale ? "text-orange-600 dark:text-orange-400 font-medium" : "text-[#8E8983] dark:text-gray-500"}`}>
            {getRelativeTime()}
          </span>
          {/* Stale indicator */}
          {isStale && (
            <div
              className="w-1.5 h-1.5 rounded-full bg-orange-400"
              title={`No activity in ${daysSinceActivity} days`}
            />
          )}
        </div>

        {/* Right side indicators */}
        <div className="flex items-center gap-2">
          {/* Today badge */}
          {appointmentToday && (
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
              Today
            </span>
          )}
          {/* Appointment scheduled indicator (if not today) */}
          {hasScheduledAppointment && !appointmentToday && (
            <div
              className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"
              title="Appointment scheduled"
            >
              <svg
                className="w-3 h-3 text-amber-600 dark:text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
