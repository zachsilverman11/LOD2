"use client";

import { useState, Suspense } from "react";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LeadDetailModal } from "@/components/lead-detail/lead-detail-modal";
import { LeadDetailPanel } from "@/components/lead-detail-v2/lead-detail-panel";
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
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-gray-900">
      <DashboardHeader subtitle="Pipeline" />
      <main className="max-w-full mx-auto px-6 lg:px-8 py-6">
        <div className="animate-pulse bg-white/50 dark:bg-gray-800/50 rounded-xl h-96" />
      </main>
    </div>
  );
}

function DashboardContent() {
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);
  const { preference, setPreference, isLoaded, isOverriddenByUrl } = useUIPreference();

  const handleLeadSelect = async (leadId: string) => {
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
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-gray-900">
      <DashboardHeader subtitle="Pipeline" />

      {/* Secondary Toolbar - Search & UI Toggle */}
      <div className="bg-white dark:bg-gray-800 border-b border-[#E5E0D8] dark:border-gray-700">
        <div className="max-w-full mx-auto px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-6">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <LeadSearchBar onLeadSelect={handleLeadSelect} />
            </div>

            {/* UI Toggle */}
            {isLoaded && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-[#8E8983] dark:text-gray-500 hidden sm:block">View:</span>
                <div className="flex rounded-lg border border-[#E5E0D8] dark:border-gray-600 bg-[#FAFAF9] dark:bg-gray-900 p-0.5">
                  <button
                    onClick={() => setPreference("classic")}
                    disabled={isOverriddenByUrl}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      preference === "classic"
                        ? "bg-white dark:bg-gray-700 text-[#1C1B1A] dark:text-gray-100 shadow-sm"
                        : "text-[#55514D] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100"
                    } ${isOverriddenByUrl ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    Classic
                  </button>
                  <button
                    onClick={() => setPreference("new")}
                    disabled={isOverriddenByUrl}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      preference === "new"
                        ? "bg-white dark:bg-gray-700 text-[#1C1B1A] dark:text-gray-100 shadow-sm"
                        : "text-[#55514D] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100"
                    } ${isOverriddenByUrl ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    New UI
                  </button>
                </div>
                {isOverriddenByUrl && (
                  <span className="text-xs text-[#8E8983] dark:text-gray-500" title="UI preference set via URL parameter">
                    (URL)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Kanban Board */}
      <main className="px-6 py-6">
        <KanbanBoard
          onLeadClick={handleLeadCardClick}
          selectedLeadId={selectedLead?.id}
        />
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
              className="w-[520px] h-full bg-white dark:bg-gray-800 shadow-2xl"
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
