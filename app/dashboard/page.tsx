"use client";

import { useState, Suspense } from "react";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LeadDetailModal } from "@/components/lead-detail/lead-detail-modal";
import { LeadDetailPanel } from "@/components/lead-detail-v2/lead-detail-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { LeadSearchBar } from "@/components/lead-search-bar";
import { LeadWithRelations } from "@/types/lead";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { useUIPreference } from "@/hooks/use-ui-preference";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <DashboardHeader subtitle="Pipeline" />
      <main className="max-w-full mx-auto px-6 lg:px-8 py-6">
        <div className="animate-pulse bg-white/50 rounded-xl h-96" />
      </main>
    </div>
  );
}

function DashboardContent() {
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);
  const { preference, setPreference, isLoaded, isOverriddenByUrl } = useUIPreference();

  const handleActivityLeadClick = async (leadId: string) => {
    const res = await fetch(`/api/leads/${leadId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedLead(data);
    }
  };

  const handleLeadCardClick = async (lead: LeadWithRelations) => {
    const res = await fetch(`/api/leads/${lead.id}`);
    if (res.ok) {
      const fullLead = await res.json();
      setSelectedLead(fullLead);
    } else {
      setSelectedLead(lead);
    }
  };

  const handleClosePanel = () => setSelectedLead(null);

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <DashboardHeader subtitle="Pipeline" />

      {/* Secondary Toolbar - Search & UI Toggle */}
      <div className="bg-white border-b border-[#E5E0D8]">
        <div className="max-w-full mx-auto px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-6">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <LeadSearchBar onLeadSelect={handleActivityLeadClick} />
            </div>

            {/* UI Toggle */}
            {isLoaded && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[#8E8983] hidden sm:block">View:</span>
                <div className="flex rounded-lg border border-[#E5E0D8] bg-[#FAFAF9] p-0.5">
                  <button
                    onClick={() => setPreference("classic")}
                    disabled={isOverriddenByUrl}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      preference === "classic"
                        ? "bg-white text-[#1C1B1A] shadow-sm"
                        : "text-[#55514D] hover:text-[#1C1B1A]"
                    } ${isOverriddenByUrl ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    Classic
                  </button>
                  <button
                    onClick={() => setPreference("new")}
                    disabled={isOverriddenByUrl}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      preference === "new"
                        ? "bg-white text-[#1C1B1A] shadow-sm"
                        : "text-[#55514D] hover:text-[#1C1B1A]"
                    } ${isOverriddenByUrl ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    New UI
                  </button>
                </div>
                {isOverriddenByUrl && (
                  <span className="text-xs text-[#8E8983]" title="UI preference set via URL parameter">
                    (URL)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-full mx-auto px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Main Kanban Board */}
          <div className="flex-1 min-w-0">
            <KanbanBoard onLeadClick={handleLeadCardClick} />
          </div>

          {/* Activity Feed Sidebar */}
          <div className="w-80 flex-shrink-0 hidden xl:block">
            <div className="sticky top-24">
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

      {/* Lead Detail Panel/Modal */}
      {preference === "classic" ? (
        <LeadDetailModal
          lead={selectedLead}
          onClose={handleClosePanel}
        />
      ) : (
        selectedLead && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex justify-end"
            onClick={handleClosePanel}
          >
            <div
              className="w-[520px] h-full bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <LeadDetailPanel
                leadId={selectedLead.id}
                onClose={handleClosePanel}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}
