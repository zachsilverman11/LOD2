"use client";

import { useState, useEffect, useCallback } from "react";
import { LeadWithRelations } from "@/types/lead";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { OverviewTab } from "./overview-tab";
import { CommunicationTab } from "./communication-tab";
import { ActivityTab } from "./activity-tab";
import { ReportsTab } from "./reports-tab";
import CallSummaryModal from "@/components/lead-detail/call-summary-modal";
import {
  LeadDetailTab,
  normalizeLeadDetailTab,
} from "@/lib/lead-detail-routing";

type LeadDetailPanelProps = {
  leadId: string;
  initialTab?: LeadDetailTab;
  onTabChange?: (tab: LeadDetailTab) => void;
  onClose: () => void;
};

export function LeadDetailPanel({
  leadId,
  initialTab = "overview",
  onTabChange,
  onClose,
}: LeadDetailPanelProps) {
  const [lead, setLead] = useState<LeadWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeadDetailTab>(initialTab);

  // Call Summary Modal state
  const [callSummaryOpen, setCallSummaryOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // Edit lead state
  const [isEditing, setIsEditing] = useState(false);
  const [editedFirstName, setEditedFirstName] = useState("");
  const [editedLastName, setEditedLastName] = useState("");
  const [editedEmail, setEditedEmail] = useState("");
  const [editedPhone, setEditedPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch lead");
      }
      const data = await res.json();
      setLead(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, leadId]);

  // Handler for logging call outcome - opens the modal
  const handleLogCallOutcome = (appointmentId?: string) => {
    setSelectedAppointmentId(appointmentId || null);
    setCallSummaryOpen(true);
  };

  // Handler when call outcome is submitted successfully
  const handleCallOutcomeSubmit = () => {
    fetchLead(); // Refresh lead data to show new call outcome
  };

  // Handler to close the modal
  const handleCloseCallSummary = () => {
    setCallSummaryOpen(false);
    setSelectedAppointmentId(null);
  };

  // Handler to start editing
  const handleStartEdit = () => {
    if (lead) {
      setEditedFirstName(lead.firstName || "");
      setEditedLastName(lead.lastName || "");
      setEditedEmail(lead.email || "");
      setEditedPhone(lead.phone || "");
      setIsEditing(true);
    }
  };

  // Handler to save edits
  const handleSaveEdit = async () => {
    if (!editedFirstName.trim() || !editedLastName.trim() || !editedEmail.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editedFirstName.trim(),
          lastName: editedLastName.trim(),
          email: editedEmail.trim(),
          phone: editedPhone.trim() || null,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        fetchLead(); // Refresh lead data
      }
    } catch (error) {
      console.error("Error updating lead:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler to cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedFirstName("");
    setEditedLastName("");
    setEditedEmail("");
    setEditedPhone("");
  };

  const handleTabChange = (tab: string) => {
    const nextTab = normalizeLeadDetailTab(tab);
    setActiveTab(nextTab);
    onTabChange?.(nextTab);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800 border-t-[3px] border-t-[#625FFF] sm:border-l-[3px] sm:border-t-0 sm:border-l-[#625FFF]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#625FFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#8E8983] dark:text-gray-500">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800 border-t-[3px] border-t-[#625FFF] sm:border-l-[3px] sm:border-t-0 sm:border-l-[#625FFF]">
        <div className="text-center">
          <p className="text-sm text-[#DC2626] dark:text-red-400 mb-3">{error || "Lead not found"}</p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const leadName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unknown Lead";
  const isHollyActive = !lead.hollyDisabled;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-gray-800 border-t-[3px] border-t-[#625FFF] sm:border-l-[3px] sm:border-t-0 sm:border-l-[#625FFF]">
      {/* Header */}
      <header className="shrink-0 px-4 py-4 sm:px-6 sm:py-5 border-b border-[#E5E0D8] dark:border-gray-700">
        {/* Top row: Close button and Holly indicator */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-[#8E8983] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100 hover:bg-[#FBF3E7] dark:hover:bg-gray-700 rounded-lg transition-all duration-150"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Holly indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isHollyActive ? "bg-[#76C63E]" : "bg-[#8E8983] dark:bg-gray-500"}`}
            />
            <span className="text-xs font-medium text-[#8E8983] dark:text-gray-400">
              Holly {isHollyActive ? "Active" : "Paused"}
            </span>
          </div>
        </div>

        {/* Lead name and status */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-3">
                {/* Name fields */}
                <div className="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="text"
                    value={editedFirstName}
                    onChange={(e) => setEditedFirstName(e.target.value)}
                    placeholder="First Name"
                    className="text-lg font-semibold text-[#1C1B1A] dark:text-gray-100 border border-[#E5E0D8] dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#625FFF] focus:ring-1 focus:ring-[#625FFF] flex-1"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editedLastName}
                    onChange={(e) => setEditedLastName(e.target.value)}
                    placeholder="Last Name"
                    className="text-lg font-semibold text-[#1C1B1A] dark:text-gray-100 border border-[#E5E0D8] dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#625FFF] focus:ring-1 focus:ring-[#625FFF] flex-1"
                  />
                </div>
                {/* Email field */}
                <div>
                  <label className="block text-xs text-[#8E8983] dark:text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full text-sm text-[#1C1B1A] dark:text-gray-100 border border-[#E5E0D8] dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#625FFF] focus:ring-1 focus:ring-[#625FFF]"
                  />
                </div>
                {/* Phone field */}
                <div>
                  <label className="block text-xs text-[#8E8983] dark:text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editedPhone}
                    onChange={(e) => setEditedPhone(e.target.value)}
                    placeholder="Phone"
                    className="w-full text-sm text-[#1C1B1A] dark:text-gray-100 border border-[#E5E0D8] dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#625FFF] focus:ring-1 focus:ring-[#625FFF]"
                  />
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editedFirstName.trim() || !editedLastName.trim() || !editedEmail.trim()}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <h1 className="text-xl font-semibold text-[#1C1B1A] dark:text-gray-100 truncate mb-2">
                {leadName}
              </h1>
            )}
            {!isEditing && <StatusBadge status={lead.status} />}
          </div>
        </div>

        {/* Primary actions */}
        <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleTabChange("communication")}
            className="w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Send Manual SMS
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleLogCallOutcome()}
            className="w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Log Call
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={handleStartEdit}
            disabled={isEditing}
            className="w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs
        defaultTab="overview"
        activeTab={activeTab}
        onTabChange={handleTabChange}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabList className="px-4 sm:px-6 flex-shrink-0">
          <Tab value="overview">Overview</Tab>
          <Tab value="communication">Communication</Tab>
          <Tab value="activity">Activity</Tab>
          <Tab value="reports">Reports</Tab>
        </TabList>

        <div className="flex-1 overflow-y-auto bg-[#FAFAF9] dark:bg-gray-900">
          <TabPanel value="overview">
            <OverviewTab lead={lead} onRefresh={fetchLead} onLogCallOutcome={handleLogCallOutcome} />
          </TabPanel>
          <TabPanel value="communication">
            <CommunicationTab lead={lead} onRefresh={fetchLead} onLogCallOutcome={handleLogCallOutcome} />
          </TabPanel>
          <TabPanel value="activity">
            <ActivityTab lead={lead} onRefresh={fetchLead} />
          </TabPanel>
          <TabPanel value="reports">
            <ReportsTab lead={lead} />
          </TabPanel>
        </div>
      </Tabs>

      {/* Call Summary Modal */}
      {callSummaryOpen && (
        <CallSummaryModal
          leadId={lead.id}
          leadName={leadName}
          appointmentId={selectedAppointmentId}
          onClose={handleCloseCallSummary}
          onSubmit={handleCallOutcomeSubmit}
        />
      )}
    </div>
  );
}
