"use client";

import { useState } from "react";
import { DevCardWithComments, PRIORITY_LABELS, TYPE_LABELS } from "@/types/dev-card";
import { format } from "date-fns";

interface DevCardModalProps {
  card: DevCardWithComments | null;
  onClose: () => void;
}

export function DevCardModal({ card, onClose }: DevCardModalProps) {
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!card) return null;

  const isAIGenerated = card.createdBy === "HOLLY_AI";
  const metadata = card.metadata as any;

  const handleAddComment = async () => {
    if (!newComment.trim() || !authorName.trim()) return;

    setIsSubmitting(true);
    try {
      await fetch(`/api/dev-cards/${card.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment,
          authorName,
        }),
      });

      setNewComment("");
      // Refresh the page to show new comment
      window.location.reload();
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E4DDD3] px-6 py-4 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-[#1C1B1A]">{card.title}</h2>
            <div className="flex gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#B1AFFF]/20 text-[#625FFF]">
                {TYPE_LABELS[card.type]}
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#FFD93D]/20 text-[#1C1B1A]">
                {PRIORITY_LABELS[card.priority]}
              </span>
              {isAIGenerated && (
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#FFB6E1]/20 text-[#FF1493]">
                  🤖 AI Detected
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#55514D] hover:text-[#1C1B1A] text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          {card.description && (
            <div>
              <h3 className="text-sm font-semibold text-[#55514D] mb-2">Description</h3>
              <p className="text-[#1C1B1A] whitespace-pre-wrap">{card.description}</p>
            </div>
          )}

          {/* Screenshot */}
          {card.screenshotUrl && (
            <div>
              <h3 className="text-sm font-semibold text-[#55514D] mb-2">Screenshot</h3>
              <a
                href={card.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={card.screenshotUrl}
                  alt="Card screenshot"
                  className="max-w-full rounded-lg border border-[#E4DDD3] hover:border-[#625FFF] cursor-pointer transition-colors"
                />
              </a>
              <p className="text-xs text-[#55514D] mt-1">Click to view full size</p>
            </div>
          )}

          {/* AI Metadata */}
          {metadata && (
            <div className="bg-[#F6D7FF]/20 p-4 rounded-lg border border-[#F6D7FF]">
              <h3 className="text-sm font-semibold text-[#1C1B1A] mb-3">AI Analysis</h3>

              {metadata.impact && (
                <div className="mb-3">
                  <span className="text-xs font-semibold text-[#55514D]">Impact:</span>
                  <p className="text-sm text-[#1C1B1A] mt-1">{metadata.impact}</p>
                </div>
              )}

              {metadata.evidence && (
                <div className="mb-3">
                  <span className="text-xs font-semibold text-[#55514D]">Evidence:</span>
                  <p className="text-sm text-[#1C1B1A] mt-1">{metadata.evidence}</p>
                </div>
              )}

              {metadata.suggestion && (
                <div>
                  <span className="text-xs font-semibold text-[#55514D]">Suggested Fix:</span>
                  <p className="text-sm text-[#1C1B1A] mt-1">{metadata.suggestion}</p>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-[#55514D] mb-3">
              Comments ({card.comments.length})
            </h3>

            <div className="space-y-3 mb-4">
              {card.comments.map((comment) => (
                <div key={comment.id} className="bg-[#FBF3E7] p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-[#1C1B1A]">
                      {comment.authorName}
                    </span>
                    <span className="text-xs text-[#55514D]">
                      {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-[#1C1B1A] whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Add Comment Form */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Your name"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF]"
              />
              <textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:border-[#625FFF]"
              />
              <button
                onClick={handleAddComment}
                disabled={isSubmitting || !newComment.trim() || !authorName.trim()}
                className="px-4 py-2 bg-[#625FFF] text-white rounded-md hover:bg-[#4E4BCC] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Adding..." : "Add Comment"}
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-[#55514D] pt-4 border-t border-[#E4DDD3]">
            <p>Created by {isAIGenerated ? "Holly (AI)" : card.createdBy} on {format(new Date(card.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
            {card.deployedAt && (
              <p className="mt-1">Deployed on {format(new Date(card.deployedAt), "MMM d, yyyy 'at' h:mm a")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
