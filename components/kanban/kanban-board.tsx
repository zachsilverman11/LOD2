"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { LeadStatus } from "@/app/generated/prisma";
import { LeadWithRelations, PIPELINE_STAGES } from "@/types/lead";
import { KanbanColumn } from "./kanban-column";
import { LeadCard } from "./lead-card";

interface KanbanBoardProps {
  onLeadClick: (lead: LeadWithRelations) => void;
}

export function KanbanBoard({ onLeadClick }: KanbanBoardProps) {
  const [leads, setLeads] = useState<LeadWithRelations[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch("/api/leads");
      const data = await response.json();

      if (!response.ok || data.error) {
        console.error("API error:", data.error || data.details);
        setLeads([]);
        return;
      }

      setLeads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) {
      setActiveId(null);
      return;
    }

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    // Update on server
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error("Error updating lead:", error);
      // Revert on error
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? lead : l))
      );
    }

    setActiveId(null);
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-gray-500">Loading leads...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage.id}
            status={stage.id}
            label={stage.label}
            color={stage.color}
            leads={getLeadsByStatus(stage.id)}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <LeadCard lead={activeLead} onClick={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
