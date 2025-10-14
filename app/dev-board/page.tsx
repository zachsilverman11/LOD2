"use client";

import { useState } from "react";
import Link from "next/link";
import { DevBoard } from "@/components/dev-board/dev-board";
import { DevCardModal } from "@/components/dev-board/dev-card-modal";
import { DevCardWithComments, DevCardType, DevCardPriority } from "@/types/dev-card";

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
        // Reset form and refresh page
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
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-[#E4DDD3]">
        <div className="max-w-full mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-[#1C1B1A]">
                <span className="italic text-[#625FFF]">development</span> <span className="font-bold">board.</span>
              </h1>
              <p className="text-[#55514D] mt-2 text-lg">Track features, bugs, and improvements</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewCardForm(!showNewCardForm)}
                className="px-4 py-2 text-sm bg-[#625FFF] text-white rounded-md hover:bg-[#4E4BCC] transition-colors"
              >
                + New Card
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm text-[#625FFF] border border-[#625FFF] rounded-md hover:bg-[#625FFF] hover:text-white transition-colors"
              >
                Lead Dashboard
              </Link>
            </div>
          </div>

          {/* New Card Form */}
          {showNewCardForm && (
            <div className="mt-6 bg-white p-6 rounded-lg border border-[#E4DDD3]">
              <h2 className="text-xl font-bold text-[#1C1B1A] mb-4">Create New Card</h2>
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
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
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
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
                    placeholder="Detailed description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#55514D] mb-1">
                    Screenshot (optional)
                  </label>
                  <input
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
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
                  />
                  {formData.screenshotUrl && (
                    <p className="text-xs text-[#55514D] mt-1">✓ Screenshot attached</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#55514D] mb-1">
                      Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as DevCardType })}
                      className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
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
                      className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
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
                      className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-[#625FFF] text-white rounded-md hover:bg-[#4E4BCC] disabled:opacity-50"
                  >
                    {isSubmitting ? "Creating..." : "Create Card"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCardForm(false)}
                    className="px-4 py-2 border border-[#E4DDD3] text-[#55514D] rounded-md hover:bg-[#E4DDD3]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-full mx-auto px-8 py-8">
        <DevBoard onCardClick={setSelectedCard} />
      </main>

      <DevCardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  );
}
