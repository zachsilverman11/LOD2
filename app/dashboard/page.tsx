"use client";

import { useState } from "react";
import Link from "next/link";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LeadDetailModal } from "@/components/lead-detail/lead-detail-modal";
import { ActivityFeed } from "@/components/activity-feed";
import { LeadSearchBar } from "@/components/lead-search-bar";
import { LeadWithRelations } from "@/types/lead";
import { LogoutButton } from "./logout-button";

export default function DashboardPage() {
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);

  const handleActivityLeadClick = async (leadId: string) => {
    // Fetch the full lead details
    const res = await fetch(`/api/leads/${leadId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedLead(data);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-[#E4DDD3]">
        <div className="max-w-full mx-auto px-8 py-6">
          <div className="flex items-center justify-between gap-8">
            <div className="flex-shrink-0">
              <h1 className="text-4xl font-extrabold text-[#1C1B1A]">
                <span className="italic text-[#625FFF]">inspired</span> <span className="font-bold">mortgage.</span>
              </h1>
              <p className="text-[#55514D] mt-2 text-lg">Lead Conversion Dashboard</p>
            </div>

            {/* Search Bar - Center */}
            <div className="flex-1 max-w-xl">
              <LeadSearchBar onLeadSelect={handleActivityLeadClick} />
            </div>

            {/* Action Buttons - Right */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                href="/dev-board"
                className="px-4 py-2 text-sm text-[#625FFF] border border-[#625FFF] rounded-md hover:bg-[#625FFF] hover:text-white transition-colors"
              >
                Dev Board
              </Link>
              <Link
                href="/dashboard/analytics"
                className="px-4 py-2 text-sm text-[#625FFF] border border-[#625FFF] rounded-md hover:bg-[#625FFF] hover:text-white transition-colors"
              >
                Analytics
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-8 py-8">
        <div className="flex gap-6">
          {/* Main Kanban Board - Takes most of the space */}
          <div className="flex-1 min-w-0">
            <KanbanBoard onLeadClick={setSelectedLead} />
          </div>

          {/* Activity Feed Sidebar - Fixed narrow width */}
          <div className="w-80 flex-shrink-0 hidden xl:block">
            <div className="sticky top-8">
              <ActivityFeed
                onLeadClick={handleActivityLeadClick}
                limit={15}
                autoRefresh={true}
                refreshInterval={30}
              />
            </div>
          </div>
        </div>
      </main>

      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}
