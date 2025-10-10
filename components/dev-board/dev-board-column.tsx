"use client";

import { useDroppable } from "@dnd-kit/core";
import { DevCardWithComments, DevCardStatus } from "@/types/dev-card";
import { DevCard } from "./dev-card";

interface DevBoardColumnProps {
  status: DevCardStatus;
  label: string;
  color: string;
  cards: DevCardWithComments[];
  onCardClick: (card: DevCardWithComments) => void;
}

export function DevBoardColumn({
  status,
  label,
  color,
  cards,
  onCardClick,
}: DevBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-shrink-0 w-80">
      <div
        className="rounded-lg mb-3 border-2"
        style={{
          borderColor: color,
          backgroundColor: 'white'
        }}
      >
        <h2
          className="text-base font-bold px-4 py-3"
          style={{ color }}
        >
          {label}
          <span className="ml-2 text-sm opacity-75">({cards.length})</span>
        </h2>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[500px] rounded-lg p-3 transition-colors ${
          isOver ? "bg-[#625FFF]/10" : "bg-transparent"
        }`}
      >
        <div className="space-y-3">
          {cards.map((card) => (
            <DevCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
