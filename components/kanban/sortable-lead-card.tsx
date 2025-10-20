"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LeadWithRelations } from "@/types/lead";
import { LeadCard } from "./lead-card";
import { useRef } from "react";

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

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  // Track mouse down position to detect if it's a drag or click
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  // Only trigger click if mouse hasn't moved much (not a drag)
  const handleClick = (e: React.MouseEvent) => {
    if (dragStartPos.current) {
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);

      // If mouse moved less than 5px, it's a click, not a drag
      if (dx < 5 && dy < 5) {
        onClick();
      }
      dragStartPos.current = null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'z-50 rotate-3 scale-105' : ''}
      onMouseDown={handleMouseDown}
      {...attributes}
      {...listeners}
    >
      <LeadCard lead={lead} onClick={handleClick} />
    </div>
  );
}
