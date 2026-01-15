"use client";

import { useState, useRef, useEffect } from "react";
import { LeadWithRelations, TEAM_MEMBERS, TeamMember } from "@/types/lead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { format } from "date-fns";

type CommunicationTabProps = {
  lead: LeadWithRelations;
  onRefresh: () => void;
  onLogCallOutcome?: (appointmentId?: string) => void;
};

// Map call outcomes to badge variants
const outcomeToVariant: Record<string, "success" | "warning" | "info" | "neutral" | "purple" | "pink"> = {
  READY_FOR_APP: "success",
  BOOK_DISCOVERY: "info",
  FOLLOW_UP_SOON: "warning",
  NOT_INTERESTED: "neutral",
  WRONG_NUMBER: "neutral",
};

export function CommunicationTab({ lead, onRefresh, onLogCallOutcome }: CommunicationTabProps) {
  const [showManualSms, setShowManualSms] = useState(false);
  const [manualSmsText, setManualSmsText] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsAuthor, setSmsAuthor] = useState<TeamMember>(TEAM_MEMBERS[0]);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const smsConversationRef = useRef<HTMLDivElement>(null);

  // Filter communications by channel
  const smsCommunications = lead.communications?.filter(c => c.channel === "SMS") || [];
  const emailCommunications = lead.communications?.filter(c => c.channel === "EMAIL") || [];
  const callOutcomes = lead.callOutcomes || [];

  // Scroll SMS conversation to bottom on mount
  useEffect(() => {
    if (smsConversationRef.current) {
      smsConversationRef.current.scrollTop = smsConversationRef.current.scrollHeight;
    }
  }, [lead.id, smsCommunications.length]);

  // Send manual SMS
  const handleSendManualSms = async () => {
    if (!manualSmsText.trim()) return;

    setIsSendingSms(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}/manual-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: manualSmsText,
          sentBy: smsAuthor,
        }),
      });

      if (response.ok) {
        setManualSmsText("");
        setShowManualSms(false);
        onRefresh();
      } else {
        const error = await response.json();
        alert(`Failed to send SMS: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error sending manual SMS:", error);
      alert("Error sending SMS");
    } finally {
      setIsSendingSms(false);
    }
  };

  // Toggle email expansion
  const toggleEmail = (emailId: string) => {
    setExpandedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  // Toggle notes expansion
  const toggleNotes = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  return (
    <div className="p-5 space-y-5">
      {/* SMS Conversation */}
      <section>
        <SectionLabel>SMS Conversation</SectionLabel>
        <Card>
          <CardContent className="p-0">
            {/* SMS Messages */}
            <div
              ref={smsConversationRef}
              className="p-4 space-y-3 max-h-80 overflow-y-auto bg-[#FAFAF9]"
            >
              {smsCommunications.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-[#FBF3E7] rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-[#8E8983]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm text-[#8E8983]">No messages yet</p>
                </div>
              ) : (
                smsCommunications
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((comm) => {
                    const isManual = comm.metadata && typeof comm.metadata === "object" && "isManual" in comm.metadata && comm.metadata.isManual === true;
                    const sentBy = comm.metadata && typeof comm.metadata === "object" && "sentBy" in comm.metadata ? String(comm.metadata.sentBy) : null;
                    const isOutbound = comm.direction === "OUTBOUND";

                    return (
                      <div
                        key={comm.id}
                        className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                      >
                        <div className="max-w-[80%]">
                          {/* Sender label for outbound */}
                          {isOutbound && !isManual && (
                            <p className="text-xs text-[#8E8983] mb-1 text-right">Holly</p>
                          )}
                          {isOutbound && isManual && (
                            <p className="text-xs text-[#8E8983] mb-1 text-right">{sentBy || "Manual"}</p>
                          )}

                          {/* Message bubble */}
                          <div
                            className={`px-4 py-2.5 ${
                              isOutbound
                                ? isManual
                                  ? "bg-[#D9F36E] text-[#1C1B1A] rounded-2xl rounded-br-md"
                                  : "bg-[#625FFF] text-white rounded-2xl rounded-br-md"
                                : "bg-white border border-[#E5E0D8] text-[#1C1B1A] rounded-2xl rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{comm.content}</p>
                          </div>

                          {/* Timestamp */}
                          <p className={`text-xs text-[#8E8983] mt-1 ${isOutbound ? "text-right" : "text-left"}`}>
                            {format(new Date(comm.createdAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Send SMS Section */}
            <div className="p-4 border-t border-[#E5E0D8]">
              {!lead.consentSms && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                  <svg className="w-4 h-4 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-[#DC2626]">This lead has opted out of SMS communication</p>
                </div>
              )}

              {!showManualSms ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowManualSms(true)}
                  disabled={!lead.consentSms}
                  className="w-full"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Manual SMS
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#8E8983]">
                    Holly will see this message and learn from your communication style
                  </p>

                  {/* Author select */}
                  <div>
                    <label className="block text-xs font-medium text-[#8E8983] mb-1">
                      Your Name
                    </label>
                    <select
                      value={smsAuthor}
                      onChange={(e) => setSmsAuthor(e.target.value as TeamMember)}
                      className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A] bg-white"
                    >
                      {TEAM_MEMBERS.map((member) => (
                        <option key={member} value={member}>{member}</option>
                      ))}
                    </select>
                  </div>

                  {/* Message textarea */}
                  <div>
                    <label className="block text-xs font-medium text-[#8E8983] mb-1">
                      Message
                    </label>
                    <textarea
                      value={manualSmsText}
                      onChange={(e) => setManualSmsText(e.target.value)}
                      rows={4}
                      maxLength={1600}
                      placeholder="Type your message..."
                      className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A] resize-none"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-[#8E8983]">
                        {manualSmsText.length}/1600
                      </span>
                      {manualSmsText.match(/https?:\/\/[^\s]+/g) && (
                        <span className="text-xs text-[#625FFF]">Link detected</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSendManualSms}
                      disabled={isSendingSms || !manualSmsText.trim()}
                      className="flex-1"
                    >
                      {isSendingSms ? "Sending..." : "Send SMS"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowManualSms(false);
                        setManualSmsText("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Email Conversation */}
      <section>
        <SectionLabel>Email Conversation</SectionLabel>
        <Card>
          <CardContent className="p-0">
            {emailCommunications.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-[#FBF3E7] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#8E8983]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-[#8E8983]">No emails yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E0D8]">
                {emailCommunications
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((comm) => {
                    const isExpanded = expandedEmails.has(comm.id);
                    const subject = comm.metadata && typeof comm.metadata === "object" && "subject" in comm.metadata
                      ? String(comm.metadata.subject)
                      : "No subject";
                    const isOutbound = comm.direction === "OUTBOUND";

                    return (
                      <div key={comm.id}>
                        <button
                          onClick={() => toggleEmail(comm.id)}
                          className="w-full p-4 text-left hover:bg-[#FAFAF9] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {isOutbound && (
                                  <Badge variant="purple">Holly</Badge>
                                )}
                                {!isOutbound && (
                                  <Badge variant="neutral">Lead</Badge>
                                )}
                              </div>
                              <p className="font-medium text-sm text-[#1C1B1A] truncate">
                                {subject}
                              </p>
                              <p className="text-xs text-[#8E8983] mt-0.5">
                                {format(new Date(comm.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                            <svg
                              className={`w-4 h-4 text-[#8E8983] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4">
                            <div className="p-4 bg-[#FAFAF9] rounded-lg border border-[#E5E0D8]">
                              {isOutbound ? (
                                <div
                                  className="text-sm text-[#1C1B1A] prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ __html: comm.content }}
                                />
                              ) : (
                                <p className="text-sm text-[#1C1B1A] whitespace-pre-wrap">{comm.content}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Call History */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel className="mb-0">Call History</SectionLabel>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onLogCallOutcome?.()}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Log Call
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {callOutcomes.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-[#FBF3E7] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#8E8983]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <p className="text-sm text-[#8E8983]">No calls logged yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E0D8]">
                {callOutcomes
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 10)
                  .map((outcome) => {
                    const isExpanded = expandedNotes.has(outcome.id);
                    const hasLongNotes = outcome.notes && outcome.notes.length > 100;

                    return (
                      <div key={outcome.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-[#1C1B1A]">
                                {outcome.advisorName}
                              </span>
                              <Badge variant={outcomeToVariant[outcome.outcome] || "neutral"}>
                                {outcome.outcome.replace(/_/g, " ")}
                              </Badge>
                            </div>

                            {outcome.notes && (
                              <div className="mt-2">
                                <p className="text-sm text-[#55514D] italic">
                                  &ldquo;{isExpanded || !hasLongNotes
                                    ? outcome.notes
                                    : `${outcome.notes.substring(0, 100)}...`}&rdquo;
                                </p>
                                {hasLongNotes && (
                                  <button
                                    onClick={() => toggleNotes(outcome.id)}
                                    className="text-xs text-[#625FFF] hover:underline mt-1"
                                  >
                                    {isExpanded ? "Show less" : "Show more"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <span className="text-xs text-[#8E8983] whitespace-nowrap">
                            {format(new Date(outcome.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
