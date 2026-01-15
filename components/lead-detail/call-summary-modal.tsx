"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CallSummaryModalProps {
  leadId: string;
  leadName: string;
  appointmentId?: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export default function CallSummaryModal({
  leadId,
  leadName,
  appointmentId,
  onClose,
  onSubmit,
}: CallSummaryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    advisorName: "",
    reached: true,
    outcome: "",
    notes: "",
    leadQuality: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.advisorName || !formData.outcome) {
      alert("Please select advisor and outcome");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/leads/${leadId}/call-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          appointmentId: appointmentId || null,
        }),
      });

      if (response.ok) {
        onSubmit();
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to log call outcome: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error logging call outcome:", error);
      alert("Error logging call outcome");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selection button component for consistent styling
  const SelectButton = ({
    selected,
    onClick,
    children,
    className = "",
  }: {
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 ${
        selected
          ? "border-[#625FFF] bg-[#625FFF]/5"
          : "border-[#E5E0D8] hover:border-[#B1AFFF]"
      } ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[#1C1B1A]">Log Call Outcome</h2>
              <p className="text-sm text-[#8E8983] mt-1">Call with {leadName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#8E8983] hover:text-[#1C1B1A] hover:bg-[#FBF3E7] rounded-lg transition-all duration-150"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Advisor Name */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-3">
                Who called?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <SelectButton
                  selected={formData.advisorName === "Greg Williamson"}
                  onClick={() => setFormData({ ...formData, advisorName: "Greg Williamson" })}
                >
                  <div className="font-medium text-[#1C1B1A]">Greg Williamson</div>
                </SelectButton>
                <SelectButton
                  selected={formData.advisorName === "Jakub Huncik"}
                  onClick={() => setFormData({ ...formData, advisorName: "Jakub Huncik" })}
                >
                  <div className="font-medium text-[#1C1B1A]">Jakub Huncik</div>
                </SelectButton>
              </div>
            </div>

            {/* Did you reach them? */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-3">
                Did you speak with the lead?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <SelectButton
                  selected={formData.reached === true}
                  onClick={() => setFormData({ ...formData, reached: true })}
                >
                  <div className="font-medium text-[#1C1B1A]">Yes, spoke with them</div>
                </SelectButton>
                <SelectButton
                  selected={formData.reached === false}
                  onClick={() => setFormData({ ...formData, reached: false, outcome: "NO_ANSWER" })}
                >
                  <div className="font-medium text-[#1C1B1A]">No answer / Voicemail</div>
                </SelectButton>
              </div>
            </div>

            {/* Outcome - only show if they reached the lead */}
            {formData.reached && (
              <div>
                <label className="block text-sm font-medium text-[#1C1B1A] mb-3">
                  What&apos;s the next step?
                </label>
                <div className="space-y-2">
                  <SelectButton
                    selected={formData.outcome === "READY_FOR_APP"}
                    onClick={() => setFormData({ ...formData, outcome: "READY_FOR_APP" })}
                    className="w-full"
                  >
                    <div className="font-medium text-[#1C1B1A]">Ready to Apply</div>
                    <div className="text-xs text-[#8E8983] mt-0.5">
                      Lead is ready now - Holly sends Finmo link immediately
                    </div>
                  </SelectButton>

                  <SelectButton
                    selected={formData.outcome === "BOOK_DISCOVERY"}
                    onClick={() => setFormData({ ...formData, outcome: "BOOK_DISCOVERY" })}
                    className="w-full"
                  >
                    <div className="font-medium text-[#1C1B1A]">Book Discovery Call</div>
                    <div className="text-xs text-[#8E8983] mt-0.5">
                      Lead wants formal call - Holly sends Cal.com booking link
                    </div>
                  </SelectButton>

                  <SelectButton
                    selected={formData.outcome === "FOLLOW_UP_SOON"}
                    onClick={() => setFormData({ ...formData, outcome: "FOLLOW_UP_SOON" })}
                    className="w-full"
                  >
                    <div className="font-medium text-[#1C1B1A]">Follow Up in 2-3 Days</div>
                    <div className="text-xs text-[#8E8983] mt-0.5">
                      Lead interested but thinking - Holly pauses then resumes nurturing
                    </div>
                  </SelectButton>

                  <SelectButton
                    selected={formData.outcome === "NOT_INTERESTED"}
                    onClick={() => setFormData({ ...formData, outcome: "NOT_INTERESTED" })}
                    className="w-full"
                  >
                    <div className="font-medium text-[#1C1B1A]">Not Interested</div>
                    <div className="text-xs text-[#8E8983] mt-0.5">
                      Lead not a fit - Moves to LOST, Holly stops automation
                    </div>
                  </SelectButton>

                  <SelectButton
                    selected={formData.outcome === "WRONG_NUMBER"}
                    onClick={() => setFormData({ ...formData, outcome: "WRONG_NUMBER" })}
                    className="w-full"
                  >
                    <div className="font-medium text-[#1C1B1A]">Wrong Number</div>
                    <div className="text-xs text-[#8E8983] mt-0.5">
                      Invalid contact - Flagged for review, Holly pauses SMS
                    </div>
                  </SelectButton>
                </div>
              </div>
            )}

            {/* Lead Quality - only show if they reached the lead and it's not NOT_INTERESTED or WRONG_NUMBER */}
            {formData.reached && formData.outcome && !["NOT_INTERESTED", "WRONG_NUMBER"].includes(formData.outcome) && (
              <div>
                <label className="block text-sm font-medium text-[#1C1B1A] mb-3">
                  Lead Quality <span className="text-[#8E8983] font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <SelectButton
                    selected={formData.leadQuality === "hot"}
                    onClick={() => setFormData({ ...formData, leadQuality: "hot" })}
                    className="text-center"
                  >
                    <div className="text-sm font-medium text-[#1C1B1A]">Hot</div>
                  </SelectButton>
                  <SelectButton
                    selected={formData.leadQuality === "warm"}
                    onClick={() => setFormData({ ...formData, leadQuality: "warm" })}
                    className="text-center"
                  >
                    <div className="text-sm font-medium text-[#1C1B1A]">Warm</div>
                  </SelectButton>
                  <SelectButton
                    selected={formData.leadQuality === "cold"}
                    onClick={() => setFormData({ ...formData, leadQuality: "cold" })}
                    className="text-center"
                  >
                    <div className="text-sm font-medium text-[#1C1B1A]">Cold</div>
                  </SelectButton>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-2">
                Notes <span className="text-[#8E8983] font-normal">(optional, but helpful for Holly)</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="E.g., Discussed No Penalty Program, interested in refinancing in 3 months..."
                rows={4}
                className="w-full px-4 py-3 text-sm border border-[#E5E0D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A] resize-none"
              />
              <p className="text-xs text-[#8E8983] mt-2">
                These notes give Holly context for follow-up messages
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4 border-t border-[#E5E0D8]">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !formData.advisorName || !formData.outcome}
                className="flex-1"
              >
                {isSubmitting ? "Saving..." : "Save Call Outcome"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
