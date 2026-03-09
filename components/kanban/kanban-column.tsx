"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LeadStatus } from "@/app/generated/prisma";
import { LeadWithRelations } from "@/types/lead";
import { SortableLeadCard } from "./sortable-lead-card";

interface KanbanColumnProps {
  status: LeadStatus;
  label: string;
  headerBg: string;
  textColor: string;
  borderColor: string;
  leads: LeadWithRelations[];
  onLeadClick: (lead: LeadWithRelations) => void;
  selectedLeadId?: string | null;
}

export function KanbanColumn({
  status,
  label,
  headerBg,
  textColor,
  borderColor,
  leads,
  onLeadClick,
  selectedLeadId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="w-[85vw] min-w-[85vw] max-w-[85vw] flex-shrink-0 snap-start sm:flex-1 sm:min-w-[260px] sm:max-w-[300px]">
      {/* Column Header */}
      <div
        className={`${headerBg} ${textColor} px-4 py-3 rounded-t-xl flex justify-between items-center transition-all border-b ${borderColor} ${
          isOver ? "ring-2 ring-[#625FFF] ring-offset-2" : ""
        }`}
      >
        <h2 className="font-semibold text-sm leading-tight">{label}</h2>
        <span className={`text-sm font-semibold ${textColor} bg-white/60 px-2 py-0.5 rounded-full min-w-[24px] text-center`}>
          {leads.length}
        </span>
      </div>

      {/* Column Body - fixed height with internal scrolling */}
      <div
        ref={setNodeRef}
        className={`bg-white dark:bg-gray-800 rounded-b-xl min-h-[240px] max-h-[calc(100dvh-250px)] overflow-y-auto p-3 pr-2 space-y-3 border border-t-0 transition-all scroll-touch touch-pan-y overscroll-y-contain scrollbar-thin scrollbar-thumb-[#E5E0D8] dark:scrollbar-thumb-gray-600 scrollbar-track-transparent sm:min-h-[200px] sm:max-h-[calc(100vh-220px)] ${
          isOver
            ? "border-[#625FFF] bg-[#625FFF]/5 dark:bg-[#625FFF]/10 shadow-md"
            : "border-[#E5E0D8] dark:border-gray-700 shadow-sm"
        }`}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              isSelected={selectedLeadId === lead.id}
            />
          ))}
        </SortableContext>

        {/* Empty State */}
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[#E5E0D8] dark:border-gray-600 rounded-xl bg-[#FAFAF9]/50 dark:bg-gray-900/50">
            <svg
              className="w-8 h-8 text-[#D1CDC7] dark:text-gray-600 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-xs text-[#8E8983] dark:text-gray-500 text-center px-4">No leads in this stage</p>
          </div>
        )}
      </div>
    </div>
  );
}
