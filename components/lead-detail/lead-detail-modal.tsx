"use client";

import { LeadWithRelations, TEAM_MEMBERS } from "@/types/lead";
import { format } from "date-fns";
import { useState } from "react";

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

  if (!lead) return null;

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
          {/* Contact Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">Contact Information</h3>
            <div className="space-y-2 text-[#55514D]">
              <p><strong className="text-[#1C1B1A]">Email:</strong> {lead.email}</p>
              {lead.phone && <p><strong className="text-[#1C1B1A]">Phone:</strong> {lead.phone}</p>}
              <p><strong className="text-[#1C1B1A]">Status:</strong> <span className="px-2 py-1 bg-[#625FFF]/10 text-[#625FFF] rounded border border-[#625FFF]/30">{lead.status}</span></p>
              {lead.source && <p><strong className="text-[#1C1B1A]">Source:</strong> {lead.source}</p>}
            </div>
          </div>

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
                    .filter(([key]) => !['name', 'email', 'phone', 'consent'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-[#1C1B1A] capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="text-[#55514D] ml-2">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
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
                {lead.appointments.map((appt) => (
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
                            'bg-[#FBF3E7] text-[#55514D] border-[#E4DDD3]'
                          }`}>{appt.status}</span>
                        </p>
                      </div>
                    </div>
                    {appt.meetingUrl && (
                      <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-[#625FFF] hover:underline text-sm mt-2 block">
                        Join Meeting →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SMS Conversation */}
          {lead.communications && lead.communications.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-[#1C1B1A]">SMS Conversation</h3>
              <div className="bg-[#FBF3E7]/50 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto border border-[#E4DDD3]">
                {lead.communications
                  .filter((comm) => comm.channel === "SMS")
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((comm) => (
                    <div
                      key={comm.id}
                      className={`flex ${comm.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-4 py-2 ${
                          comm.direction === "OUTBOUND"
                            ? "bg-[#625FFF] text-white"
                            : "bg-white border border-[#E4DDD3]"
                        }`}
                      >
                        <p className="text-sm">{comm.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            comm.direction === "OUTBOUND" ? "text-[#B1AFFF]" : "text-[#55514D]"
                          }`}
                        >
                          {format(new Date(comm.createdAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
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
    </div>
  );
}
