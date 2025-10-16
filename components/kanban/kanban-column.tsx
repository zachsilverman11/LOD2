"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LeadStatus } from "@/app/generated/prisma";
import { LeadWithRelations } from "@/types/lead";
import { SortableLeadCard } from "./sortable-lead-card";

interface KanbanColumnProps {
  status: LeadStatus;
  label: string;
  color: string;
  leads: LeadWithRelations[];
  onLeadClick: (lead: LeadWithRelations) => void;
}

export function KanbanColumn({ status, label, color, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-1 min-w-[300px] max-w-[350px]">
      <div className={`${color} text-white px-4 py-3 rounded-t-lg flex justify-between items-center shadow-md transition-all ${isOver ? 'ring-4 ring-blue-400 ring-offset-2' : ''}`}>
        <h2 className="font-bold text-lg">{label}</h2>
        <span className="bg-white bg-opacity-25 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`bg-white/60 backdrop-blur-sm p-4 rounded-b-lg min-h-[600px] space-y-3 border-x border-b transition-all ${
          isOver
            ? 'border-blue-400 border-4 bg-blue-50/60 shadow-lg'
            : 'border-[#E4DDD3]'
        }`}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-sm">No leads in this stage</p>
          </div>
        )}
      </div>
    </div>
  );
}
