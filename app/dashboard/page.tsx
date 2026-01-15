"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LeadDetailModal } from "@/components/lead-detail/lead-detail-modal";
import { LeadDetailPanel } from "@/components/lead-detail-v2/lead-detail-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { LeadSearchBar } from "@/components/lead-search-bar";
import { LeadWithRelations } from "@/types/lead";
import { LogoutButton } from "./logout-button";
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
          </div>
        </div>
      </header>
      <main className="max-w-full mx-auto px-8 py-8">
        <div className="animate-pulse bg-white/50 rounded-xl h-96" />
      </main>
    </div>
  );
}

function DashboardContent() {
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);
  const { preference, setPreference, isLoaded, isOverriddenByUrl } = useUIPreference();

  const handleActivityLeadClick = async (leadId: string) => {
    // Fetch the full lead details
    const res = await fetch(`/api/leads/${leadId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedLead(data);
    }
  };

  const handleLeadCardClick = async (lead: LeadWithRelations) => {
    // Fetch full lead details (including all communications)
    // The kanban board only loads 5 communications per lead for performance
    const res = await fetch(`/api/leads/${lead.id}`);
    if (res.ok) {
      const fullLead = await res.json();
      setSelectedLead(fullLead);
    } else {
      // Fallback to partial data if fetch fails
      setSelectedLead(lead);
    }
  };

  const handleClosePanel = () => setSelectedLead(null);

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
              {/* UI Toggle */}
              {isLoaded && (
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-[#E4DDD3] bg-white p-0.5">
                    <button
                      onClick={() => setPreference("classic")}
                      disabled={isOverriddenByUrl}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        preference === "classic"
                          ? "bg-[#625FFF] text-white"
                          : "text-[#55514D] hover:text-[#1C1B1A]"
                      } ${isOverriddenByUrl ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      Classic
                    </button>
                    <button
                      onClick={() => setPreference("new")}
                      disabled={isOverriddenByUrl}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                        preference === "new"
                          ? "bg-[#625FFF] text-white"
                          : "text-[#55514D] hover:text-[#1C1B1A]"
                      } ${isOverriddenByUrl ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      New UI
                      {preference === "new" && (
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                          ✨
                        </span>
                      )}
                    </button>
                  </div>
                  {isOverriddenByUrl && (
                    <span className="text-xs text-[#8E8983]" title="UI preference set via URL parameter">
                      (URL)
                    </span>
                  )}
                </div>
              )}

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
            <KanbanBoard onLeadClick={handleLeadCardClick} />
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

      {/* Conditionally render Classic or New UI based on preference */}
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
