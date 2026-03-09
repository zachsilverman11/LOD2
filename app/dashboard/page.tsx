"use client";

import { useState, Suspense, useEffect, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { LeadDetailModal } from "@/components/lead-detail/lead-detail-modal";
import { LeadDetailPanel } from "@/components/lead-detail-v2/lead-detail-panel";
import { LeadSearchBar } from "@/components/lead-search-bar";
import { LeadWithRelations } from "@/types/lead";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { useUIPreference } from "@/hooks/use-ui-preference";
import {
  LeadDetailTab,
  normalizeLeadDetailTab,
} from "@/lib/lead-detail-routing";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(null);
  const { preference, setPreference, isLoaded, isOverriddenByUrl } = useUIPreference();
  const selectedLeadId = searchParams.get("lead");
  const selectedTab = normalizeLeadDetailTab(searchParams.get("tab"));

  useEffect(() => {
    console.log(`selectedLeadId set to: ${selectedLeadId}`);
  }, [selectedLeadId]);

  const updateDashboardQuery = useCallback((leadId?: string | null, tab?: LeadDetailTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (leadId) {
      nextParams.set("lead", leadId);
    } else {
      nextParams.delete("lead");
    }

    if (leadId && tab && tab !== "overview") {
      nextParams.set("tab", tab);
    } else {
      nextParams.delete("tab");
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSelectedLead() {
      if (!selectedLeadId) {
        setSelectedLead(null);
        return;
      }

      setSelectedLead((currentLead) =>
        currentLead?.id === selectedLeadId ? currentLead : null
      );

      try {
        const res = await fetch(`/api/leads/${selectedLeadId}`);
        if (!res.ok) {
          if (!isCancelled) {
            setSelectedLead(null);
          }
          return;
        }

        const data = await res.json();
        if (!isCancelled) {
          setSelectedLead(data);
        }
      } catch (error) {
        console.error("Failed to fetch selected lead:", error);
        if (!isCancelled) {
          setSelectedLead(null);
        }
      }
    }

    loadSelectedLead();

    return () => {
      isCancelled = true;
    };
  }, [selectedLeadId]);

  const handleLeadSelect = (leadId: string) => {
    updateDashboardQuery(leadId);
  };

  const handleLeadCardClick = (lead: LeadWithRelations) => {
    setSelectedLead(lead);
    updateDashboardQuery(lead.id);
  };

  const handleClosePanel = () => updateDashboardQuery(null);

  const handlePanelTabChange = (tab: LeadDetailTab) => {
    if (!selectedLeadId) {
      return;
    }

    updateDashboardQuery(selectedLeadId, tab);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-gray-900">
      <DashboardHeader subtitle="Pipeline" />

      {/* Secondary Toolbar - Search & UI Toggle */}
      <div className="bg-white dark:bg-gray-800 border-b border-[#E5E0D8] dark:border-gray-700">
        <div className="max-w-full mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            {/* Search Bar */}
            <div className="w-full max-w-md">
              <LeadSearchBar onLeadSelect={handleLeadSelect} />
            </div>

            {/* UI Toggle */}
            {isLoaded && (
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
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
      <main className="px-4 py-4 sm:px-6 sm:py-6">
        <KanbanBoard
          onLeadClick={handleLeadCardClick}
          selectedLeadId={selectedLeadId}
        />
      </main>

      {/* Lead Detail Panel/Modal */}
      {preference === "classic" ? (
        <LeadDetailModal
          lead={selectedLead}
          onClose={handleClosePanel}
        />
      ) : (
        selectedLeadId && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex justify-end"
            onClick={handleClosePanel}
          >
            <div
              className="h-[100dvh] w-full bg-white dark:bg-gray-800 shadow-2xl sm:h-full sm:w-[520px]"
              onClick={(e) => e.stopPropagation()}
            >
              <LeadDetailPanel
                leadId={selectedLeadId}
                initialTab={selectedTab}
                onTabChange={handlePanelTabChange}
                onClose={handleClosePanel}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
}
