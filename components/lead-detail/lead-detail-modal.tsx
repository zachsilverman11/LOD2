"use client";

import { LeadWithRelations, TEAM_MEMBERS } from "@/types/lead";
import { format } from "date-fns";
import { useState } from "react";
import CallSummaryModal from "./call-summary-modal";

// Helper function to format source names
const formatSource = (source: string): string => {
  if (!source) return "Unknown";

  // Handle common sources
  const sourceMap: Record<string, string> = {
    "leads_on_demand": "Leads On Demand",
    "facebook": "Facebook",
    "google": "Google Ads",
    "referral": "Referral",
    "organic": "Organic Search",
    "direct": "Direct",
  };

  return sourceMap[source.toLowerCase()] || source
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper function to format field names
const formatFieldName = (key: string): string => {
  // Special field name mappings
  const fieldMap: Record<string, string> = {
    "lead_type": "Loan Type",
    "prop_type": "Property Type",
    "home_value": "Home Value",
    "down_payment": "Down Payment",
    "ad_source": "Ad Source",
    "capture_time": "Submitted",
    "motivation_level": "Timeline",
    "first_name": "First Name",
    "last_name": "Last Name",
    "rent_check": "Has Rent Income",
    "loanAmount": "Loan Amount",
    "purchasePrice": "Purchase Price",
    "downPayment": "Down Payment",
    "creditScore": "Credit Score",
    "propertyType": "Property Type",
    "loanType": "Loan Type",
    "employmentStatus": "Employment Status",
  };

  // Check if we have a custom mapping
  const lowerKey = key.toLowerCase();
  if (fieldMap[lowerKey]) return fieldMap[lowerKey];

  // Otherwise, format the key
  return key
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Helper function to format field values
const formatFieldValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return "—";

  const lowerKey = key.toLowerCase();

  // Currency fields
  if (lowerKey.includes('value') || lowerKey.includes('amount') || lowerKey.includes('payment') || lowerKey.includes('price')) {
    const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    if (!isNaN(num)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(num);
    }
  }

  // Date/time fields
  if (lowerKey.includes('time') || lowerKey.includes('date')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return format(date, "MMM d, yyyy 'at' h:mm a");
      }
    } catch (e) {
      // Not a valid date, continue
    }
  }

  // Boolean fields
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle "Yes"/"No" strings for rent_check
  if (lowerKey.includes('rent') && (value === 'Yes' || value === 'No')) {
    return value;
  }

  // Object/Array
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

interface LeadDetailModalProps {
  lead: LeadWithRelations | null;
  onClose: () => void;
}

export function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState(TEAM_MEMBERS[0]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState(TEAM_MEMBERS[0]);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [showCallSummaryModal, setShowCallSummaryModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [showManualSms, setShowManualSms] = useState(false);
  const [manualSmsText, setManualSmsText] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);

  if (!lead) return null;

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

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      const response = await fetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote, createdBy: noteAuthor }),
      });

      if (response.ok) {
        setNewNote("");
        setIsAddingNote(false);
        window.location.reload(); // Simple refresh for now
      }
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      const response = await fetch(`/api/leads/${lead.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription || null,
          assignedTo: taskAssignedTo,
          createdBy: noteAuthor,
          dueDate: taskDueDate || null,
        }),
      });

      if (response.ok) {
        setNewTaskTitle("");
        setNewTaskDescription("");
        setTaskDueDate("");
        setIsAddingTask(false);
        window.location.reload(); // Simple refresh for now
      }
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      await fetch(`/api/leads/${lead.id}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const handleSendManualSms = async () => {
    if (!manualSmsText.trim()) return;

    setIsSendingSms(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}/manual-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: manualSmsText,
          sentBy: noteAuthor // Use same author selector as notes
        }),
      });

      if (response.ok) {
        setManualSmsText("");
        setShowManualSms(false);
        window.location.reload(); // Simple refresh for now
      } else {
        const error = await response.json();
        alert(`Failed to send SMS: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error sending manual SMS:", error);
      alert("Error sending SMS");
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleMarkNoShow = async (appointmentId: string) => {
    if (!confirm("Mark this appointment as no-show? This will move the lead back to ENGAGED and trigger a recovery message.")) {
      return;
    }

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/mark-no-show`, {
        method: "POST",
      });

      if (response.ok) {
        alert("Appointment marked as no-show");
        window.location.reload(); // Simple refresh for now
      } else {
        alert("Failed to mark as no-show");
      }
    } catch (error) {
      console.error("Error marking as no-show:", error);
      alert("Error marking as no-show");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-[#E4DDD3]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#E4DDD3] px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[#1C1B1A]">
            {lead.firstName} {lead.lastName}
          </h2>
          <button
            onClick={onClose}
            className="text-[#55514D] hover:text-[#1C1B1A] text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Log Call Outcome - Always Available */}
          <div className="mb-6 flex justify-between items-center p-4 bg-[#FBF3E7]/50 border border-[#625FFF]/30 rounded-lg">
            <div>
              <span className="text-sm font-semibold text-[#1C1B1A]">📞 Log Call Outcome</span>
              <p className="text-xs text-[#55514D]">Record any phone conversation</p>
            </div>
            <button
              onClick={() => {
                setSelectedAppointmentId(null);
                setShowCallSummaryModal(true);
              }}
              className="px-4 py-2 bg-[#625FFF] text-white rounded-md hover:bg-[#4E4BCC] transition-colors text-sm font-medium"
            >
              Log Call
            </button>
          </div>

          {/* Call History */}
          {lead.callOutcomes && lead.callOutcomes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-[#625FFF]">Call History ({lead.callOutcomes.length})</h3>
              <div className="space-y-2">
                {lead.callOutcomes.slice(0, 5).map((outcome) => (
                  <div key={outcome.id} className="border border-[#E4DDD3] rounded p-3 bg-white text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-medium text-[#1C1B1A]">{outcome.advisorName}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                          outcome.outcome === 'READY_FOR_APP' ? 'bg-[#D9F36E]/30 text-[#1C1B1A]' :
                          outcome.outcome === 'NOT_INTERESTED' ? 'bg-red-100 text-red-700' :
                          'bg-[#FBF3E7] text-[#55514D]'
                        }`}>
                          {outcome.outcome.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-[#55514D]">
                        {format(new Date(outcome.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {outcome.notes && (
                      <p className="text-xs text-[#55514D] mt-1 italic">"{outcome.notes.substring(0, 100)}{outcome.notes.length > 100 ? '...' : ''}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual SMS - Human Intervention */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-[#625FFF]">💬 Manual Text Message</h3>
              <button
                onClick={() => setShowManualSms(!showManualSms)}
                disabled={!lead.consentSms}
                className={`text-xs px-3 py-1 rounded transition-colors ${
                  lead.consentSms
                    ? 'bg-[#625FFF] text-white hover:bg-[#4E4BCC]'
                    : 'bg-[#E4DDD3] text-[#55514D] cursor-not-allowed'
                }`}
                title={!lead.consentSms ? "Lead has opted out of SMS" : ""}
              >
                {showManualSms ? "Cancel" : "Send Manual SMS"}
              </button>
            </div>

            {!lead.consentSms && (
              <p className="text-xs text-[#B34040] italic mb-2">
                ⚠️ This lead has opted out of SMS communication
              </p>
            )}

            {showManualSms && (
              <div className="border border-[#625FFF]/30 rounded-lg p-4 bg-[#FBF3E7]/30">
                <p className="text-xs text-[#55514D] mb-3 italic">
                  Holly will see this message and learn from your communication style
                </p>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#55514D] mb-1">
                    Your Name
                  </label>
                  <select
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded text-sm focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
                  >
                    {TEAM_MEMBERS.map((member) => (
                      <option key={member} value={member}>{member}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#55514D] mb-1">
                    Message
                  </label>
                  <textarea
                    value={manualSmsText}
                    onChange={(e) => setManualSmsText(e.target.value)}
                    rows={4}
                    maxLength={1600}
                    placeholder="Type your message to the customer..."
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded text-sm focus:outline-none focus:border-[#625FFF] text-[#1C1B1A]"
                  />
                  <p className="text-xs text-[#55514D] mt-1">
                    {manualSmsText.length}/1600 characters
                  </p>
                </div>

                <button
                  onClick={handleSendManualSms}
                  disabled={isSendingSms || !manualSmsText.trim()}
                  className="w-full px-4 py-2 bg-[#625FFF] text-white rounded hover:bg-[#4E4BCC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isSendingSms ? "Sending..." : "Send SMS Now"}
                </button>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">Contact Information</h3>
            <div className="space-y-2 text-[#55514D]">
              <p><strong className="text-[#1C1B1A]">Email:</strong> {lead.email}</p>
              {lead.phone && <p><strong className="text-[#1C1B1A]">Phone:</strong> {lead.phone}</p>}
              <p><strong className="text-[#1C1B1A]">Status:</strong> <span className="px-2 py-1 bg-[#625FFF]/10 text-[#625FFF] rounded border border-[#625FFF]/30">{lead.status}</span></p>
              {lead.source && <p><strong className="text-[#1C1B1A]">Source:</strong> {formatSource(lead.source)}</p>}
            </div>
          </div>

          {/* Application Status */}
          {(lead.applicationStartedAt || lead.applicationCompletedAt) && (
            <div className="mb-6 p-4 border-2 border-[#D9F36E] bg-[#D9F36E]/10 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">🎉 Application Status</h3>
              <div className="space-y-2">
                {lead.applicationStartedAt && (
                  <p className="text-[#1C1B1A]">
                    <strong>Started:</strong> {new Date(lead.applicationStartedAt).toLocaleDateString()} at {new Date(lead.applicationStartedAt).toLocaleTimeString()}
                  </p>
                )}
                {lead.applicationCompletedAt && (
                  <p className="text-[#1C1B1A]">
                    <strong>Completed:</strong> {new Date(lead.applicationCompletedAt).toLocaleDateString()} at {new Date(lead.applicationCompletedAt).toLocaleTimeString()}
                    <span className="ml-2 px-2 py-1 bg-[#76C63E] text-white rounded font-semibold">CONVERTED ✓</span>
                  </p>
                )}
                {lead.applicationStartedAt && !lead.applicationCompletedAt && (
                  <p className="text-sm text-[#55514D] italic">
                    Application in progress - Holly is nurturing to completion
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Consent Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">Consent</h3>
            <div className="flex gap-3">
              <span className={`px-3 py-1 rounded border ${lead.consentEmail ? 'bg-[#D9F36E]/30 text-[#1C1B1A] border-[#D9F36E]' : 'bg-[#FBF3E7] text-[#55514D] border-[#E4DDD3]'}`}>
                Email {lead.consentEmail ? '✓' : '✗'}
              </span>
              <span className={`px-3 py-1 rounded border ${lead.consentSms ? 'bg-[#D9F36E]/30 text-[#1C1B1A] border-[#D9F36E]' : 'bg-[#FBF3E7] text-[#55514D] border-[#E4DDD3]'}`}>
                SMS {lead.consentSms ? '✓' : '✗'}
              </span>
              <span className={`px-3 py-1 rounded border ${lead.consentCall ? 'bg-[#D9F36E]/30 text-[#1C1B1A] border-[#D9F36E]' : 'bg-[#FBF3E7] text-[#55514D] border-[#E4DDD3]'}`}>
                Call {lead.consentCall ? '✓' : '✗'}
              </span>
            </div>
          </div>

          {/* Lead Details from Leads on Demand */}
          {lead.rawData && typeof lead.rawData === 'object' && Object.keys(lead.rawData as object).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">Lead Details</h3>
              <div className="bg-[#FBF3E7]/50 border border-[#E4DDD3] rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(lead.rawData as Record<string, any>)
                    .filter(([key]) => !['name', 'email', 'phone', 'consent', 'lastCallOutcome', 'callOutcome'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-[#1C1B1A]">
                          {formatFieldName(key)}:
                        </span>
                        <span className="text-[#55514D] ml-2">
                          {formatFieldValue(key, value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-[#1C1B1A]">Notes</h3>
              <button
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="text-sm px-3 py-1.5 bg-[#625FFF] text-white rounded hover:bg-[#625FFF]/90 transition-colors"
              >
                {isAddingNote ? "Cancel" : "Add Note"}
              </button>
            </div>

            {isAddingNote && (
              <div className="mb-4 p-4 border border-[#E4DDD3] rounded-lg bg-[#FBF3E7]/30">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">Your Name</label>
                  <select
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
                  >
                    {TEAM_MEMBERS.map((member) => (
                      <option key={member} value={member}>{member}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this lead..."
                  className="w-full px-3 py-2 border border-[#E4DDD3] rounded focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent resize-none"
                  rows={3}
                />
                <button
                  onClick={handleAddNote}
                  className="mt-2 px-4 py-2 bg-[#625FFF] text-white rounded hover:bg-[#625FFF]/90 transition-colors"
                >
                  Save Note
                </button>
              </div>
            )}

            <div className="space-y-3">
              {lead.notes?.length === 0 ? (
                <p className="text-sm text-[#55514D] italic">No notes yet</p>
              ) : (
                lead.notes?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((note) => (
                  <div key={note.id} className="p-3 bg-white border border-[#E4DDD3] rounded">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-[#625FFF]">{note.createdBy}</span>
                      <span className="text-xs text-[#55514D]">
                        {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-[#1C1B1A] whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tasks Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-[#1C1B1A]">Tasks</h3>
              <button
                onClick={() => setIsAddingTask(!isAddingTask)}
                className="text-sm px-3 py-1.5 bg-[#625FFF] text-white rounded hover:bg-[#625FFF]/90 transition-colors"
              >
                {isAddingTask ? "Cancel" : "Add Task"}
              </button>
            </div>

            {isAddingTask && (
              <div className="mb-4 p-4 border border-[#E4DDD3] rounded-lg bg-[#FBF3E7]/30">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">Task Title</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g., Follow up on documents"
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">Description (optional)</label>
                  <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Additional details..."
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent resize-none"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-[#1C1B1A] mb-1">Assign To</label>
                    <select
                      value={taskAssignedTo}
                      onChange={(e) => setTaskAssignedTo(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E4DDD3] rounded focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
                    >
                      {TEAM_MEMBERS.map((member) => (
                        <option key={member} value={member}>{member}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1C1B1A] mb-1">Due Date (optional)</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E4DDD3] rounded focus:outline-none focus:ring-2 focus:ring-[#625FFF] focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddTask}
                  className="px-4 py-2 bg-[#625FFF] text-white rounded hover:bg-[#625FFF]/90 transition-colors"
                >
                  Create Task
                </button>
              </div>
            )}

            <div className="space-y-2">
              {lead.tasks?.length === 0 ? (
                <p className="text-sm text-[#55514D] italic">No tasks yet</p>
              ) : (
                lead.tasks?.sort((a, b) => {
                  if (a.completed !== b.completed) return a.completed ? 1 : -1;
                  if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                  return 0;
                }).map((task) => (
                  <div key={task.id} className={`p-3 border rounded ${task.completed ? 'bg-[#FBF3E7]/50 border-[#E4DDD3]' : 'bg-white border-[#E4DDD3]'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task.id, task.completed)}
                        className="mt-1 w-4 h-4 text-[#625FFF] border-[#E4DDD3] rounded focus:ring-[#625FFF]"
                      />
                      <div className="flex-1">
                        <p className={`font-medium ${task.completed ? 'line-through text-[#55514D]' : 'text-[#1C1B1A]'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-sm text-[#55514D] mt-1">{task.description}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-[#55514D]">
                          <span>Assigned to: <span className="font-medium text-[#625FFF]">{task.assignedTo}</span></span>
                          {task.dueDate && (
                            <span>Due: {format(new Date(task.dueDate), "MMM d, yyyy")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Appointments */}
          {lead.appointments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">Appointments</h3>
              <div className="space-y-3">
                {lead.appointments.map((appt) => {
                  const appointmentTime = new Date(appt.scheduledAt);
                  const now = new Date();
                  const hoursSince = (now.getTime() - appointmentTime.getTime()) / (1000 * 60 * 60);
                  const showNoShowButton = appt.status === 'completed' && hoursSince >= 0 && hoursSince <= 24;

                  return (
                    <div key={appt.id} className="border border-[#E4DDD3] rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-[#1C1B1A]">
                            {format(new Date(appt.scheduledAt), "MMMM d, yyyy 'at' h:mm a")}
                          </p>
                          <p className="text-sm text-[#55514D]">Duration: {appt.duration} minutes</p>
                          <p className="text-sm text-[#55514D]">
                            Status: <span className={`px-2 py-1 rounded border ${
                              appt.status === 'scheduled' ? 'bg-[#D9F36E]/30 text-[#1C1B1A] border-[#D9F36E]' :
                              appt.status === 'completed' ? 'bg-[#625FFF]/10 text-[#625FFF] border-[#625FFF]/30' :
                              appt.status === 'no_show' ? 'bg-red-100 text-red-700 border-red-300' :
                              'bg-[#FBF3E7] text-[#55514D] border-[#E4DDD3]'
                            }`}>{appt.status === 'no_show' ? 'no-show' : appt.status}</span>
                          </p>
                          {appt.advisorName && (
                            <p className="text-sm text-[#55514D]">with {appt.advisorName}</p>
                          )}
                        </div>
                        {showNoShowButton && (
                          <button
                            onClick={() => handleMarkNoShow(appt.id)}
                            className="px-3 py-1 text-sm bg-red-50 text-red-700 border border-red-300 rounded hover:bg-red-100 transition-colors"
                          >
                            Mark as No-Show
                          </button>
                        )}
                      </div>
                      {appt.meetingUrl && (
                        <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-[#625FFF] hover:underline text-sm mt-2 block">
                          Join Meeting →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SMS Conversation */}
          {lead.communications && lead.communications.filter((c) => c.channel === "SMS").length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">📱 SMS Conversation</h3>
              <div className="bg-[#FBF3E7]/50 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto border border-[#E4DDD3]">
                {lead.communications
                  .filter((comm) => comm.channel === "SMS")
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((comm) => {
                    const isManual = comm.metadata && typeof comm.metadata === 'object' && 'isManual' in comm.metadata && comm.metadata.isManual === true;
                    const sentBy = comm.metadata && typeof comm.metadata === 'object' && 'sentBy' in comm.metadata ? String(comm.metadata.sentBy) : null;

                    return (
                      <div
                        key={comm.id}
                        className={`flex ${comm.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-4 py-2 ${
                            comm.direction === "OUTBOUND"
                              ? isManual
                                ? "bg-[#D9F36E] text-[#1C1B1A]"
                                : "bg-[#625FFF] text-white"
                              : "bg-white border border-[#E4DDD3]"
                          }`}
                        >
                          {isManual && (
                            <p className="text-xs font-semibold mb-1 opacity-75">
                              👤 {sentBy || 'Manual'}
                            </p>
                          )}
                          <p className="text-sm">{comm.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              comm.direction === "OUTBOUND"
                                ? isManual
                                  ? "text-[#55514D]"
                                  : "text-[#B1AFFF]"
                                : "text-[#55514D]"
                            }`}
                          >
                            {format(new Date(comm.createdAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Email Conversation */}
          {lead.communications && lead.communications.filter((c) => c.channel === "EMAIL").length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">📧 Email Conversation</h3>
              <div className="bg-white rounded-lg border border-[#E4DDD3] overflow-hidden">
                {lead.communications
                  .filter((comm) => comm.channel === "EMAIL")
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((comm, index) => {
                    const isExpanded = expandedEmails.has(comm.id);
                    return (
                      <div
                        key={comm.id}
                        className={`${index > 0 ? 'border-t border-[#E4DDD3]' : ''} ${
                          comm.direction === "OUTBOUND" ? "bg-[#FBF3E7]/30" : "bg-white"
                        }`}
                      >
                        <button
                          onClick={() => toggleEmail(comm.id)}
                          className="w-full p-4 text-left hover:bg-black/5 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                comm.direction === "OUTBOUND"
                                  ? "bg-[#625FFF] text-white"
                                  : "bg-[#E4DDD3] text-[#1C1B1A]"
                              }`}>
                                {comm.direction === "OUTBOUND" ? "Sent by Holly" : "Received from Lead"}
                              </span>
                              {comm.metadata && typeof comm.metadata === 'object' && 'subject' in comm.metadata && (
                                <span className="text-sm font-medium text-[#1C1B1A]">
                                  {(comm.metadata as any).subject}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#55514D]">
                                {format(new Date(comm.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                              <span className="text-[#625FFF]">{isExpanded ? '▼' : '▶'}</span>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 text-sm text-[#1C1B1A] prose prose-sm max-w-none">
                            {comm.direction === "OUTBOUND" ? (
                              <div dangerouslySetInnerHTML={{ __html: comm.content }} />
                            ) : (
                              <p className="whitespace-pre-wrap">{comm.content}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* System Activity Timeline */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">Activity Timeline</h3>
            <div className="space-y-3">
              {lead.activities
                .filter((activity) => !["SMS_SENT", "SMS_RECEIVED"].includes(activity.type))
                .map((activity) => {
                  // Determine color based on activity type
                  let borderColor = "border-[#E4DDD3]";

                  if (activity.type === "APPOINTMENT_BOOKED") {
                    borderColor = "border-[#D9F36E]";
                  } else if (activity.type === "APPOINTMENT_CANCELLED") {
                    borderColor = "border-[#F6D7FF]";
                  } else if (activity.type === "STATUS_CHANGE") {
                    borderColor = "border-[#625FFF]";
                  } else if (activity.type === "WEBHOOK_RECEIVED") {
                    borderColor = "border-[#B1AFFF]";
                  } else if (activity.type.includes("EMAIL")) {
                    borderColor = "border-[#625FFF]";
                  } else if (activity.type.includes("CALL")) {
                    borderColor = "border-[#B1AFFF]";
                  }

                  return (
                    <div key={activity.id} className={`border-l-4 ${borderColor} pl-4 py-3`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-[#1C1B1A]">
                            {activity.type.replace(/_/g, " ")}
                          </p>
                          {activity.subject && (
                            <p className="text-sm text-[#1C1B1A] mt-1">{activity.subject}</p>
                          )}
                          {activity.content && (
                            <p className="text-sm text-[#55514D] mt-1">{activity.content}</p>
                          )}
                        </div>
                        <span className="text-sm text-[#55514D] whitespace-nowrap ml-4">
                          {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      </div>

      {/* Call Summary Modal */}
      {showCallSummaryModal && (
        <CallSummaryModal
          leadId={lead.id}
          leadName={`${lead.firstName} ${lead.lastName}`}
          appointmentId={selectedAppointmentId}
          onClose={() => {
            setShowCallSummaryModal(false);
            setSelectedAppointmentId(null);
          }}
          onSubmit={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
