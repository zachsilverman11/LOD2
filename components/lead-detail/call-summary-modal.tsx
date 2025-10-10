"use client";

import { useState } from "react";

interface CallSummaryModalProps {
  leadId: string;
  leadName: string;
  onClose: () => void;
  onSubmit: () => void;
}

export default function CallSummaryModal({
  leadId,
  leadName,
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
        body: JSON.stringify(formData),
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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Log Call Outcome</h2>
              <p className="text-sm text-gray-500 mt-1">Call with {leadName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Advisor Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Who called? *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, advisorName: "Greg Williamson" })}
                  className={`px-4 py-3 rounded-lg border-2 text-center transition-all ${
                    formData.advisorName === "Greg Williamson"
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">Greg Williamson</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, advisorName: "Jakub Huncik" })}
                  className={`px-4 py-3 rounded-lg border-2 text-center transition-all ${
                    formData.advisorName === "Jakub Huncik"
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">Jakub Huncik</div>
                </button>
              </div>
            </div>

            {/* Did you reach them? */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Did you speak with the lead? *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, reached: true })}
                  className={`px-4 py-3 rounded-lg border-2 text-center transition-all ${
                    formData.reached === true
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">✅ Yes, spoke with them</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, reached: false, outcome: "NO_ANSWER" })}
                  className={`px-4 py-3 rounded-lg border-2 text-center transition-all ${
                    formData.reached === false
                      ? "border-[#625FFF] bg-[#625FFF]/10"
                      : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                  }`}
                >
                  <div className="font-semibold text-[#1C1B1A]">❌ No answer / Voicemail</div>
                </button>
              </div>
            </div>

            {/* Outcome - only show if they reached the lead */}
            {formData.reached && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What's the next step? *
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, outcome: "READY_FOR_APP" })}
                    className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      formData.outcome === "READY_FOR_APP"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="font-semibold text-[#1C1B1A]">🚀 Ready to Apply</div>
                    <div className="text-xs text-[#55514D]">
                      Lead is ready now - Holly will send Finmo application link & move to CALL_COMPLETED
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, outcome: "BOOK_DISCOVERY" })}
                    className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      formData.outcome === "BOOK_DISCOVERY"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="font-semibold text-[#1C1B1A]">📅 Book Discovery Call</div>
                    <div className="text-xs text-[#55514D]">
                      Lead wants formal call - Holly will send Cal.com booking link
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, outcome: "FOLLOW_UP_SOON" })}
                    className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      formData.outcome === "FOLLOW_UP_SOON"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="font-semibold text-[#1C1B1A]">⏰ Follow Up in 2-3 Days</div>
                    <div className="text-xs text-[#55514D]">
                      Lead interested but thinking - Holly pauses 48h then resumes nurturing
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, outcome: "NOT_INTERESTED" })}
                    className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      formData.outcome === "NOT_INTERESTED"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="font-semibold text-[#1C1B1A]">🚫 Not Interested</div>
                    <div className="text-xs text-[#55514D]">
                      Lead not a fit - Moves to LOST, Holly stops all automation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, outcome: "WRONG_NUMBER" })}
                    className={`w-full px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      formData.outcome === "WRONG_NUMBER"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="font-semibold text-[#1C1B1A]">📞 Wrong Number</div>
                    <div className="text-xs text-[#55514D]">
                      Invalid contact - Flagged for review, Holly pauses SMS
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Lead Quality - only show if they reached the lead and it's not NOT_INTERESTED or WRONG_NUMBER */}
            {formData.reached && formData.outcome && !["NOT_INTERESTED", "WRONG_NUMBER"].includes(formData.outcome) && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lead Quality (optional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, leadQuality: "hot" })}
                    className={`px-4 py-2 rounded-lg border-2 text-center transition-all ${
                      formData.leadQuality === "hot"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#1C1B1A]">🔥 Hot</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, leadQuality: "warm" })}
                    className={`px-4 py-2 rounded-lg border-2 text-center transition-all ${
                      formData.leadQuality === "warm"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#1C1B1A]">☀️ Warm</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, leadQuality: "cold" })}
                    className={`px-4 py-2 rounded-lg border-2 text-center transition-all ${
                      formData.leadQuality === "cold"
                        ? "border-[#625FFF] bg-[#625FFF]/10"
                        : "border-[#E4DDD3] hover:border-[#625FFF]/50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#1C1B1A]">❄️ Cold</div>
                  </button>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (optional, but helpful for Holly)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="E.g., Discussed No Penalty Program, interested in refinancing in 3 months, concerned about credit score..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 These notes give Holly context for follow-up messages
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
                {isSubmitting ? "Saving..." : "Save Call Outcome"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
