"use client";

import { useState } from "react";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LeadDetailModal } from "@/components/lead-detail/lead-detail-modal";
import { LeadWithRelations } from "@/types/lead";

export default function DashboardPage() {
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-full mx-auto px-8 py-5">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Lead Conversion Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Manage your mortgage leads through the conversion pipeline</p>
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
