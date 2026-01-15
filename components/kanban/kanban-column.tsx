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
    <div className="flex-1 min-w-[260px] max-w-[300px] flex-shrink-0">
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

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`bg-white rounded-b-xl min-h-[500px] p-3 space-y-3 border border-t-0 transition-all ${
          isOver
            ? "border-[#625FFF] bg-[#625FFF]/5 shadow-md"
            : "border-[#E5E0D8] shadow-sm"
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
          <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[#E5E0D8] rounded-xl bg-[#FAFAF9]/50">
            <svg
              className="w-8 h-8 text-[#D1CDC7] mb-2"
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
            <p className="text-xs text-[#8E8983] text-center px-4">No leads in this stage</p>
          </div>
        )}
      </div>
    </div>
  );
}
