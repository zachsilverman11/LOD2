"use client";

import { LeadWithRelations } from "@/types/lead";
import { format } from "date-fns";

interface LeadDetailModalProps {
  lead: LeadWithRelations | null;
  onClose: () => void;
}

export function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            {lead.firstName} {lead.lastName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Contact Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
            <div className="space-y-2">
              <p><strong>Email:</strong> {lead.email}</p>
              {lead.phone && <p><strong>Phone:</strong> {lead.phone}</p>}
              <p><strong>Status:</strong> <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{lead.status}</span></p>
              {lead.source && <p><strong>Source:</strong> {lead.source}</p>}
            </div>
          </div>

          {/* Consent Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Consent</h3>
            <div className="flex gap-3">
              <span className={`px-3 py-1 rounded ${lead.consentEmail ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                Email {lead.consentEmail ? '✓' : '✗'}
              </span>
              <span className={`px-3 py-1 rounded ${lead.consentSms ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                SMS {lead.consentSms ? '✓' : '✗'}
              </span>
              <span className={`px-3 py-1 rounded ${lead.consentCall ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                Call {lead.consentCall ? '✓' : '✗'}
              </span>
            </div>
          </div>

          {/* Appointments */}
          {lead.appointments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Appointments</h3>
              <div className="space-y-3">
                {lead.appointments.map((appt) => (
                  <div key={appt.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {format(new Date(appt.scheduledAt), "MMMM d, yyyy 'at' h:mm a")}
                        </p>
                        <p className="text-sm text-gray-600">Duration: {appt.duration} minutes</p>
                        <p className="text-sm">
                          Status: <span className={`px-2 py-1 rounded ${
                            appt.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                            appt.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>{appt.status}</span>
                        </p>
                      </div>
                    </div>
                    {appt.meetingUrl && (
                      <a href={appt.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm mt-2 block">
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
              <h3 className="text-lg font-semibold mb-3">💬 SMS Conversation</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
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
                            ? "bg-blue-500 text-white"
                            : "bg-white border border-gray-300"
                        }`}
                      >
                        <p className="text-sm">{comm.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            comm.direction === "OUTBOUND" ? "text-blue-100" : "text-gray-500"
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
            <h3 className="text-lg font-semibold mb-3">📋 System Activity</h3>
            <div className="space-y-3">
              {lead.activities
                .filter((activity) => !["SMS_SENT", "SMS_RECEIVED"].includes(activity.type))
                .map((activity) => {
                  // Determine icon and color based on activity type
                  let icon = "📌";
                  let borderColor = "border-gray-300";

                  if (activity.type === "APPOINTMENT_BOOKED") {
                    icon = "📅";
                    borderColor = "border-green-500";
                  } else if (activity.type === "APPOINTMENT_CANCELLED") {
                    icon = "❌";
                    borderColor = "border-red-500";
                  } else if (activity.type === "STATUS_CHANGE") {
                    icon = "🔄";
                    borderColor = "border-blue-500";
                  } else if (activity.type === "WEBHOOK_RECEIVED") {
                    icon = "📥";
                    borderColor = "border-purple-500";
                  } else if (activity.type.includes("EMAIL")) {
                    icon = "📧";
                    borderColor = "border-yellow-500";
                  } else if (activity.type.includes("CALL")) {
                    icon = "📞";
                    borderColor = "border-indigo-500";
                  }

                  return (
                    <div key={activity.id} className={`border-l-4 ${borderColor} pl-4 py-2`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">
                            {icon} {activity.type.replace(/_/g, " ")}
                          </p>
                          {activity.subject && (
                            <p className="text-sm text-gray-700 mt-1">{activity.subject}</p>
                          )}
                          {activity.content && (
                            <p className="text-sm text-gray-600 mt-1">{activity.content}</p>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                          {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Cal.com Integration Placeholder */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              📅 Cal.com scheduling widget will be integrated here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
