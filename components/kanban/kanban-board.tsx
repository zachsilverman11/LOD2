"use client";

import { useState, useEffect, useRef } from "react";
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
  selectedLeadId?: string | null;
}

export function KanbanBoard({ onLeadClick, selectedLeadId }: KanbanBoardProps) {
  const [leads, setLeads] = useState<LeadWithRelations[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  // Check scroll position for shadow indicators
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    };

    checkScroll();
    container.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      container.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [leads]);

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

    setActiveId(null);

    if (!over) {
      return;
    }

    const leadId = active.id as string;

    // Check if we dropped on a column (status) or on another lead
    // If dropped on a lead, find which column that lead belongs to
    let newStatus: LeadStatus;
    const overId = over.id as string;

    // Check if overId is a valid LeadStatus
    const isValidStatus = PIPELINE_STAGES.some(stage => stage.id === overId);

    if (isValidStatus) {
      // Dropped on a column directly
      newStatus = overId as LeadStatus;
    } else {
      // Dropped on another lead - find that lead's status
      const targetLead = leads.find((l) => l.id === overId);
      if (!targetLead) {
        return;
      }
      newStatus = targetLead.status;
    }

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) {
      return;
    }

    const oldStatus = lead.status;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    // Update on server
    try {
      console.log(`[Kanban] Updating lead ${leadId} from ${oldStatus} to ${newStatus}`);

      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Kanban] Server error:', data);
        throw new Error(data.details || data.error || 'Failed to update lead status');
      }

      console.log('[Kanban] Lead updated successfully:', data);

      // Success notification
      setNotification({
        type: 'success',
        message: `${lead.firstName} ${lead.lastName} moved to ${getPipelineStageLabel(newStatus)}`
      });

      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("[Kanban] Error updating lead:", error);

      // Revert on error
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: oldStatus } : l))
      );

      // Error notification with more details
      const errorMessage = error instanceof Error ? error.message : 'Failed to update lead. Please try again.';
      setNotification({
        type: 'error',
        message: errorMessage
      });

      setTimeout(() => setNotification(null), 5000);
    }
  };

  const getPipelineStageLabel = (status: LeadStatus): string => {
    const stage = PIPELINE_STAGES.find(s => s.id === status);
    return stage?.label || status;
  };

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter((lead) => lead.status === status);
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin w-8 h-8 border-2 border-[#625FFF] border-t-transparent rounded-full"></div>
          <p className="text-sm text-[#8E8983]">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-xl shadow-lg border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Left scroll shadow */}
        <div
          className={`absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-[#FAFAF9] to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Right scroll shadow */}
        <div
          className={`absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-[#FAFAF9] to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth scrollbar-thin scrollbar-thumb-[#E5E0D8] scrollbar-track-transparent"
        >
          {PIPELINE_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.id}
              status={stage.id}
              label={stage.label}
              headerBg={stage.headerBg}
              textColor={stage.textColor}
              borderColor={stage.borderColor}
              leads={getLeadsByStatus(stage.id)}
              onLeadClick={onLeadClick}
              selectedLeadId={selectedLeadId}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeLead ? <LeadCard lead={activeLead} onClick={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
