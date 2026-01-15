"use client";

import { useState } from "react";
import { DevBoard } from "@/components/dev-board/dev-board";
import { DevCardModal } from "@/components/dev-board/dev-card-modal";
import { DevCardWithComments, DevCardType, DevCardPriority } from "@/types/dev-card";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export default function DevBoardPage() {
  const [selectedCard, setSelectedCard] = useState<DevCardWithComments | null>(null);
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "FEATURE_REQUEST" as DevCardType,
    priority: "MEDIUM" as DevCardPriority,
    createdBy: "",
    screenshotUrl: "" as string,
  });

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/dev-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({
          title: "",
          description: "",
          type: "FEATURE_REQUEST",
          priority: "MEDIUM",
          createdBy: "",
          screenshotUrl: "",
        });
        setShowNewCardForm(false);
        window.location.reload();
      }
    } catch (error) {
      console.error("Error creating card:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <DashboardHeader subtitle="Dev Board" />

      {/* Secondary Toolbar */}
      <div className="bg-white border-b border-[#E5E0D8]">
        <div className="max-w-full mx-auto px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#55514D]">
              Track features, bugs, and improvements
            </p>
            <button
              onClick={() => setShowNewCardForm(!showNewCardForm)}
              className="px-4 py-2 text-sm font-medium bg-[#625FFF] text-white rounded-lg hover:bg-[#524DD9] transition-colors shadow-sm"
            >
              + New Card
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible New Card Form */}
      {showNewCardForm && (
        <div className="bg-white border-b border-[#E5E0D8]">
          <div className="max-w-3xl mx-auto px-6 lg:px-8 py-6">
            <h2 className="text-lg font-semibold text-[#1C1B1A] mb-4">Create New Card</h2>
            <form onSubmit={handleCreateCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#55514D] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF]/20 focus:border-[#625FFF] text-[#1C1B1A]"
                  placeholder="Brief title for the card"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#55514D] mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF]/20 focus:border-[#625FFF] text-[#1C1B1A]"
                  placeholder="Detailed description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#55514D] mb-1">
                  Screenshot (optional)
                </label>
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File too large. Max size is 5MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData({ ...formData, screenshotUrl: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onPaste={(e) => {
                    const items = e.clipboardData.items;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File too large. Max size is 5MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({ ...formData, screenshotUrl: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                        e.preventDefault();
                        break;
                      }
                    }
                  }}
                  className="border-2 border-dashed border-[#E5E0D8] rounded-lg p-4 text-center bg-[#FAFAF9] hover:border-[#625FFF] transition-colors cursor-pointer"
                  onClick={() => document.getElementById('screenshot-input')?.click()}
                  tabIndex={0}
                >
                  {formData.screenshotUrl ? (
                    <div className="space-y-2">
                      <img
                        src={formData.screenshotUrl}
                        alt="Screenshot preview"
                        className="max-h-32 mx-auto rounded"
                      />
                      <p className="text-xs text-[#55514D]">Screenshot attached (click to change)</p>
                    </div>
                  ) : (
                    <div className="py-4">
                      <p className="text-sm text-[#55514D]">
                        Drag & drop screenshot here, paste (Cmd+V), or click to upload
                      </p>
                      <p className="text-xs text-[#8E8983] mt-1">Max 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  id="screenshot-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File too large. Max size is 5MB.');
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData({ ...formData, screenshotUrl: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#55514D] mb-1">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as DevCardType })}
                    className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF]/20 focus:border-[#625FFF] text-[#1C1B1A]"
                  >
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="BUG_FIX">Bug Fix</option>
                    <option value="IMPROVEMENT">Improvement</option>
                    <option value="OPTIMIZATION">Optimization</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#55514D] mb-1">
                    Priority *
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as DevCardPriority })}
                    className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF]/20 focus:border-[#625FFF] text-[#1C1B1A]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#55514D] mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.createdBy}
                    onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#625FFF]/20 focus:border-[#625FFF] text-[#1C1B1A]"
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#625FFF] text-white text-sm font-medium rounded-lg hover:bg-[#524DD9] disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? "Creating..." : "Create Card"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCardForm(false)}
                  className="px-4 py-2 border border-[#E5E0D8] text-[#55514D] text-sm font-medium rounded-lg hover:bg-[#F5F3F0] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="max-w-full mx-auto px-6 lg:px-8 py-6">
        <DevBoard onCardClick={setSelectedCard} />
      </main>

      <DevCardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  );
}
