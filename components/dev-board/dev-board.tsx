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
import { DevCardWithComments, DevCardStatus } from "@/types/dev-card";
import { DevBoardColumn } from "./dev-board-column";
import { DevCard } from "./dev-card";

interface DevBoardProps {
  onCardClick: (card: DevCardWithComments) => void;
}

const COLUMNS = [
  {
    status: "NEW" as DevCardStatus,
    label: "New Feature Requests & Bugs",
    color: "#625FFF",
  },
  {
    status: "IN_PROGRESS" as DevCardStatus,
    label: "Working On It",
    color: "#FFD93D",
  },
  {
    status: "DEPLOYED" as DevCardStatus,
    label: "Deployed",
    color: "#6BCF7F",
  },
];

export function DevBoard({ onCardClick }: DevBoardProps) {
  const [cards, setCards] = useState<DevCardWithComments[]>([]);
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
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await fetch("/api/dev-cards");
      const data = await response.json();

      if (!response.ok || data.error) {
        console.error("API error:", data.error || data.details);
        setCards([]);
        return;
      }

      setCards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching dev cards:", error);
      setCards([]);
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

    const cardId = active.id as string;
    const newStatus = over.id as DevCardStatus;

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status === newStatus) {
      setActiveId(null);
      return;
    }

    // Optimistic update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status: newStatus } : c))
    );

    // Update on server
    try {
      await fetch(`/api/dev-cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error("Error updating card:", error);
      // Revert on error
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? card : c))
      );
    }

    setActiveId(null);
  };

  const getCardsByStatus = (status: DevCardStatus) => {
    return cards.filter((card) => card.status === status);
  };

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-gray-500">Loading dev board...</div>
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
        {COLUMNS.map((column) => (
          <DevBoardColumn
            key={column.status}
            status={column.status}
            label={column.label}
            color={column.color}
            cards={getCardsByStatus(column.status)}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <DevCard card={activeCard} onClick={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
