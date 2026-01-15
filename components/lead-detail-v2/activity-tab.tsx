"use client";

import { useState } from "react";
import { LeadWithRelations, TEAM_MEMBERS, TeamMember } from "@/types/lead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { format, formatDistanceToNow } from "date-fns";

type ActivityTabProps = {
  lead: LeadWithRelations;
  onRefresh?: () => void;
};

// Activity type configuration
const activityConfig: Record<string, { icon: string; color: string; label: string }> = {
  NOTE_ADDED: { icon: "📝", color: "bg-[#625FFF]", label: "Note Added" },
  CALL_COMPLETED: { icon: "📞", color: "bg-[#76C63E]", label: "Call Completed" },
  CALL_OUTCOME_LOGGED: { icon: "📞", color: "bg-[#76C63E]", label: "Call Outcome Logged" },
  APPOINTMENT_BOOKED: { icon: "📅", color: "bg-[#625FFF]", label: "Appointment Booked" },
  APPOINTMENT_CANCELLED: { icon: "📅", color: "bg-[#8E8983]", label: "Appointment Cancelled" },
  APPOINTMENT_NO_SHOW: { icon: "📅", color: "bg-[#DC2626]", label: "No Show" },
  STATUS_CHANGE: { icon: "🔄", color: "bg-[#8B88FF]", label: "Status Changed" },
  WEBHOOK_RECEIVED: { icon: "📨", color: "bg-[#8E8983]", label: "Webhook Received" },
  EMAIL_SENT: { icon: "✉️", color: "bg-[#625FFF]", label: "Email Sent" },
  EMAIL_RECEIVED: { icon: "✉️", color: "bg-[#8E8983]", label: "Email Received" },
  LEAD_CREATED: { icon: "✨", color: "bg-[#D9F36E]", label: "Lead Created" },
  HOLLY_ACTION: { icon: "🤖", color: "bg-[#625FFF]", label: "Holly Action" },
};

// Filter out unwanted content from activity
function shouldShowActivity(activity: { type: string; content?: string | null; subject?: string | null }): boolean {
  const content = activity.content || "";
  const subject = activity.subject || "";

  // Filter out JSON content
  if (content.includes("{") && content.includes("}")) return false;

  // Filter out error messages
  if (content.toLowerCase().includes("slack notification failed")) return false;
  if (content.toLowerCase().includes("error")) return false;

  // Filter out SMS activities (shown in Communication tab)
  if (activity.type === "SMS_SENT" || activity.type === "SMS_RECEIVED") return false;

  return true;
}

// Format activity content, especially for call notes with markdown
function formatActivityContent(content: string): { text: string; hasMore: boolean } {
  if (!content) return { text: "", hasMore: false };

  // Clean up markdown headers
  let formatted = content
    .replace(/###\s*/g, "")
    .replace(/\*\*/g, "")
    .trim();

  const hasMore = formatted.length > 150;

  return {
    text: hasMore ? formatted.substring(0, 150) + "..." : formatted,
    hasMore,
  };
}

export function ActivityTab({ lead, onRefresh }: ActivityTabProps) {
  // Notes state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState<TeamMember>(TEAM_MEMBERS[0]);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Tasks state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState<TeamMember>(TEAM_MEMBERS[0]);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Activity timeline state
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  // Add note handler
  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setIsSavingNote(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote, createdBy: noteAuthor }),
      });

      if (response.ok) {
        setNewNote("");
        setIsAddingNote(false);
        onRefresh?.();
      }
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setIsSavingNote(false);
    }
  };

  // Add task handler
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    setIsSavingTask(true);
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
        onRefresh?.();
      }
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setIsSavingTask(false);
    }
  };

  // Toggle task completion
  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      await fetch(`/api/leads/${lead.id}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });
      onRefresh?.();
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  // Toggle activity expansion
  const toggleActivity = (activityId: string) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  // Get sorted notes
  const sortedNotes = [...(lead.notes || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Get sorted tasks (incomplete first, then by due date)
  const sortedTasks = [...(lead.tasks || [])].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return 0;
  });

  // Get filtered activities
  const filteredActivities = (lead.activities || [])
    .filter(shouldShowActivity)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-5 space-y-5">
      {/* Notes Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel className="mb-0">Notes</SectionLabel>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingNote(!isAddingNote)}
          >
            {isAddingNote ? "Cancel" : "Add Note"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {/* Add Note Form */}
            {isAddingNote && (
              <div className="p-4 border-b border-[#E5E0D8] bg-[#FAFAF9]">
                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#8E8983] mb-1">Your Name</label>
                  <select
                    value={noteAuthor}
                    onChange={(e) => setNoteAuthor(e.target.value as TeamMember)}
                    className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A] bg-white"
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
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A] resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddNote}
                    disabled={isSavingNote || !newNote.trim()}
                  >
                    {isSavingNote ? "Saving..." : "Save Note"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingNote(false);
                      setNewNote("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {sortedNotes.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-[#FBF3E7] rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📝</span>
                </div>
                <p className="text-sm text-[#8E8983]">No notes yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E0D8]">
                {sortedNotes.map((note) => (
                  <div key={note.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="text-sm font-medium text-[#625FFF]">{note.createdBy}</span>
                      <span className="text-xs text-[#8E8983]">
                        {format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-[#1C1B1A] whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Tasks Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel className="mb-0">Tasks</SectionLabel>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddingTask(!isAddingTask)}
          >
            {isAddingTask ? "Cancel" : "Add Task"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {/* Add Task Form */}
            {isAddingTask && (
              <div className="p-4 border-b border-[#E5E0D8] bg-[#FAFAF9]">
                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#8E8983] mb-1">Task Title</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="e.g., Follow up on documents"
                    className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A]"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-[#8E8983] mb-1">Description (optional)</label>
                  <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Additional details..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A] resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-[#8E8983] mb-1">Assign To</label>
                    <select
                      value={taskAssignedTo}
                      onChange={(e) => setTaskAssignedTo(e.target.value as TeamMember)}
                      className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A] bg-white"
                    >
                      {TEAM_MEMBERS.map((member) => (
                        <option key={member} value={member}>{member}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#8E8983] mb-1">Due Date (optional)</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#E5E0D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] text-[#1C1B1A]"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAddTask}
                    disabled={isSavingTask || !newTaskTitle.trim()}
                  >
                    {isSavingTask ? "Creating..." : "Create Task"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingTask(false);
                      setNewTaskTitle("");
                      setNewTaskDescription("");
                      setTaskDueDate("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Tasks List */}
            {sortedTasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-[#FBF3E7] rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">✓</span>
                </div>
                <p className="text-sm text-[#8E8983]">No tasks yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E0D8]">
                {sortedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 ${task.completed ? "bg-[#FAFAF9]" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task.id, task.completed)}
                        className="mt-1 w-4 h-4 text-[#625FFF] border-[#E5E0D8] rounded focus:ring-[#B1AFFF] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.completed ? "line-through text-[#8E8983]" : "text-[#1C1B1A]"}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-sm text-[#8E8983] mt-1">{task.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2">
                          <span className="text-xs text-[#8E8983]">
                            Assigned to <span className="font-medium text-[#625FFF]">{task.assignedTo}</span>
                          </span>
                          {task.dueDate && (
                            <span className="text-xs text-[#8E8983]">
                              Due {format(new Date(task.dueDate), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Activity Timeline */}
      <section>
        <SectionLabel>Activity Timeline</SectionLabel>
        <Card>
          <CardContent className="p-0">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-[#FBF3E7] rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📋</span>
                </div>
                <p className="text-sm text-[#8E8983]">No activity yet</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-px bg-[#E5E0D8]" />

                <div className="divide-y divide-[#E5E0D8]">
                  {filteredActivities.map((activity) => {
                    const config = activityConfig[activity.type] || {
                      icon: "📌",
                      color: "bg-[#8E8983]",
                      label: activity.type.replace(/_/g, " "),
                    };

                    const isExpanded = expandedActivities.has(activity.id);
                    const contentInfo = formatActivityContent(activity.content || "");
                    const relativeTime = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });
                    const fullDate = format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a");

                    return (
                      <div key={activity.id} className="relative p-4 pl-14">
                        {/* Timeline dot */}
                        <div className={`absolute left-4 top-5 w-4 h-4 rounded-full ${config.color} flex items-center justify-center`}>
                          <span className="text-[8px]">{config.icon}</span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1C1B1A]">
                              {config.label}
                            </p>

                            {activity.subject && (
                              <p className="text-sm text-[#55514D] mt-1">{activity.subject}</p>
                            )}

                            {contentInfo.text && (
                              <div className="mt-1">
                                <p className="text-sm text-[#8E8983]">
                                  {isExpanded ? activity.content : contentInfo.text}
                                </p>
                                {contentInfo.hasMore && (
                                  <button
                                    onClick={() => toggleActivity(activity.id)}
                                    className="text-xs text-[#625FFF] hover:underline mt-1"
                                  >
                                    {isExpanded ? "Show less" : "Show more"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <span
                            className="text-xs text-[#8E8983] whitespace-nowrap cursor-help"
                            title={fullDate}
                          >
                            {relativeTime}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
