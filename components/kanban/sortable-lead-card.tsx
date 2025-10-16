"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LeadWithRelations } from "@/types/lead";
import { LeadCard } from "./lead-card";

interface SortableLeadCardProps {
  lead: LeadWithRelations;
  onClick: () => void;
}

export function SortableLeadCard({ lead, onClick }: SortableLeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'z-50 rotate-3 scale-105' : ''}
      {...attributes}
      {...listeners}
    >
      <LeadCard lead={lead} onClick={onClick} />
    </div>
  );
}
