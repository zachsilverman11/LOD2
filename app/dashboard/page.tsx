"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LeadDetailModal } from "@/components/lead-detail/lead-detail-modal";
import { LeadWithRelations } from "@/types/lead";

export default function DashboardPage() {
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-[#E4DDD3]">
        <div className="max-w-full mx-auto px-8 py-6">
          <h1 className="text-4xl font-extrabold text-[#1C1B1A]">
            <span className="italic text-[#625FFF]">inspired</span> <span className="font-bold">mortgage.</span>
          </h1>
          <p className="text-[#55514D] mt-2 text-lg">Lead Conversion Dashboard</p>
        </div>
      </header>

      <main className="max-w-full mx-auto px-8 py-8">
        <KanbanBoard onLeadClick={setSelectedLead} />
      </main>

      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
