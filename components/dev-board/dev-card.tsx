"use client";

import { DevCardWithComments, PRIORITY_COLORS, TYPE_LABELS } from "@/types/dev-card";
import { format } from "date-fns";

interface DevCardProps {
  card: DevCardWithComments;
  onClick: () => void;
}

export function DevCard({ card, onClick }: DevCardProps) {
  const isAIGenerated = card.createdBy === "HOLLY_AI";
  const priorityColor = PRIORITY_COLORS[card.priority];
  const typeLabel = TYPE_LABELS[card.type];

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow-sm border border-[#E4DDD3] cursor-pointer hover:shadow-lg hover:border-[#625FFF] transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-[#1C1B1A] text-base leading-tight">
            {card.title}
          </h3>
        </div>
        <div
          className="w-3 h-3 rounded-full ml-2 flex-shrink-0"
          style={{ backgroundColor: priorityColor }}
          title={card.priority}
        />
      </div>

      {card.description && (
        <p className="text-sm text-[#55514D] mt-2 line-clamp-2">
          {card.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#B1AFFF]/20 text-[#625FFF]">
          {typeLabel}
        </span>

        {isAIGenerated && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#FFB6E1]/20 text-[#FF1493]">
            🤖 AI Detected
          </span>
        )}

        {card.comments.length > 0 && (
          <span className="text-xs text-[#55514D]">
            💬 {card.comments.length}
          </span>
        )}
      </div>

      <div className="mt-3 text-xs text-[#55514D] flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-[#B1AFFF] rounded-full"></span>
        {isAIGenerated ? "Holly" : card.createdBy} • {format(new Date(card.createdAt), "MMM d, h:mm a")}
      </div>
    </div>
  );
}
