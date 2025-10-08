"use client";

import { useState } from "react";

interface CallSummaryModalProps {
  leadId: string;
  appointmentId: string;
  existingOutcome?: any; // Pre-populate if editing
  onClose: () => void;
  onSubmit: () => void;
}

type CallOutcome = "hot_lead" | "needs_followup" | "not_qualified" | "long_timeline";
type CallTimeline = "asap" | "1-2_weeks" | "1-3_months" | "3-6_months" | "6+_months";
type NextStep = "send_application" | "request_documents" | "compare_rates" | "schedule_followup" | "none";

export default function CallSummaryModal({
  leadId,
  appointmentId,
  existingOutcome,
  onClose,
  onSubmit,
}: CallSummaryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    outcome: (existingOutcome?.outcome || "") as CallOutcome | "",
    timeline: (existingOutcome?.timeline || "") as CallTimeline | "",
    nextStep: (existingOutcome?.nextStep || "") as NextStep | "",
    notes: existingOutcome?.notes || "",
    programsDiscussed: existingOutcome?.programsDiscussed || [] as string[],
    preferredProgram: existingOutcome?.preferredProgram || "",
  });

  const handleProgramToggle = (program: string) => {
    setFormData((prev) => ({
      ...prev,
      programsDiscussed: prev.programsDiscussed.includes(program)
        ? prev.programsDiscussed.filter((p) => p !== program)
        : [...prev.programsDiscussed, program],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.outcome) {
      alert("Please select a call outcome");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/leads/${leadId}/call-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSubmit();
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to record call summary: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error recording call summary:", error);
      alert("Error recording call summary");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {existingOutcome ? "Edit Call Outcome" : "Capture Call Outcome"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Call Outcome */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Call Outcome *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, outcome: "hot_lead" })}
                  className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                    formData.outcome === "hot_lead"
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">Hot Lead</div>
                  <div className="text-xs text-[#55514D]">Ready to apply</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, outcome: "needs_followup" })}
                  className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                    formData.outcome === "needs_followup"
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">Needs Follow-Up</div>
                  <div className="text-xs text-[#55514D]">More info needed</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, outcome: "not_qualified" })}
                  className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                    formData.outcome === "not_qualified"
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">Not Qualified</div>
                  <div className="text-xs text-[#55514D]">Not a fit</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, outcome: "long_timeline" })}
                  className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                    formData.outcome === "long_timeline"
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">Long Timeline</div>
                  <div className="text-xs text-[#55514D]">Future opportunity</div>
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Timeline
              </label>
              <select
                value={formData.timeline}
                onChange={(e) => setFormData({ ...formData, timeline: e.target.value as CallTimeline })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select timeline...</option>
                <option value="asap">ASAP</option>
                <option value="1-2_weeks">1-2 weeks</option>
                <option value="1-3_months">1-3 months</option>
                <option value="3-6_months">3-6 months</option>
                <option value="6+_months">6+ months</option>
              </select>
            </div>

            {/* Next Step */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Next Step
              </label>
              <select
                value={formData.nextStep}
                onChange={(e) => setFormData({ ...formData, nextStep: e.target.value as NextStep })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select next step...</option>
                <option value="send_application">Send Application</option>
                <option value="request_documents">Request Documents</option>
                <option value="compare_rates">Compare Rates</option>
                <option value="schedule_followup">Schedule Follow-up</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Programs Discussed */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Programs Discussed
              </label>
              <div className="space-y-2">
                {[
                  "Reserved Ultra-Low Rates",
                  "No Bank Penalties Program",
                  "Guaranteed Approvals Certificate",
                  "First-Time Buyer Program",
                  "Self-Employed Solutions",
                  "Refinance Options",
                ].map((program) => (
                  <label key={program} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.programsDiscussed.includes(program)}
                      onChange={() => handleProgramToggle(program)}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{program}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Preferred Program */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Lead's Preferred Program
              </label>
              <input
                type="text"
                value={formData.preferredProgram}
                onChange={(e) => setFormData({ ...formData, preferredProgram: e.target.value })}
                placeholder="e.g., Reserved Ultra-Low Rates"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any other important details from the call..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                These notes will be used by Holly to personalize follow-up messages
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-[#625FFF] text-white rounded-lg hover:bg-[#625FFF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : existingOutcome ? "Update Outcome" : "Save Outcome"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
