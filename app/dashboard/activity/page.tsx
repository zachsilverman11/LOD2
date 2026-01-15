"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import Link from "next/link";

interface Activity {
  id: string;
  type: string;
  content?: string;
  subject?: string;
  leadName: string;
  leadId: string;
  createdAt: string;
}

type FilterType = "all" | "sms" | "email" | "notes" | "calls" | "status";

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const isUserRelevantActivity = useCallback((activity: Activity): boolean => {
    const allowedTypes = [
      "SMS_SENT",
      "SMS_RECEIVED",
      "EMAIL_SENT",
      "EMAIL_RECEIVED",
      "STATUS_CHANGE",
      "CALL_COMPLETED",
      "APPOINTMENT_BOOKED",
      "APPOINTMENT_CANCELLED",
      "NOTE_ADDED",
    ];

    if (!allowedTypes.includes(activity.type)) {
      return false;
    }

    const content = activity.content || "";
    const contentLower = content.toLowerCase();

    if (content.trim().startsWith("{") || content.includes("**Type:**")) {
      return false;
    }

    const errorPatterns = [
      "slack notification failed",
      "failed to send",
      "error:",
      "exception:",
      '{"error',
      '"stack":',
      "internal server",
    ];

    for (const pattern of errorPatterns) {
      if (contentLower.includes(pattern)) {
        return false;
      }
    }

    return true;
  }, []);

  const matchesFilter = useCallback(
    (activity: Activity): boolean => {
      if (filter === "all") return true;
      if (filter === "sms") return activity.type === "SMS_SENT" || activity.type === "SMS_RECEIVED";
      if (filter === "email") return activity.type === "EMAIL_SENT" || activity.type === "EMAIL_RECEIVED";
      if (filter === "notes") return activity.type === "NOTE_ADDED";
      if (filter === "calls") return activity.type === "CALL_COMPLETED";
      if (filter === "status") return activity.type === "STATUS_CHANGE" || activity.type === "APPOINTMENT_BOOKED" || activity.type === "APPOINTMENT_CANCELLED";
      return true;
    },
    [filter]
  );

  const fetchActivities = useCallback(
    async (pageNum: number, append: boolean = false) => {
      setIsLoading(true);
      try {
        const limit = 50;
        const offset = pageNum * limit;
        const res = await fetch(`/api/activity/recent?limit=${limit}&offset=${offset}`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          const activityList = Array.isArray(data) ? data : [];
          const filtered = activityList.filter(isUserRelevantActivity);

          if (append) {
            setActivities((prev) => [...prev, ...filtered]);
          } else {
            setActivities(filtered);
          }

          setHasMore(activityList.length === limit);
        }
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isUserRelevantActivity]
  );

  useEffect(() => {
    setPage(0);
    fetchActivities(0, false);
  }, [fetchActivities]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchActivities(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page, fetchActivities]);

  const filteredActivities = activities.filter(matchesFilter);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "SMS_SENT":
      case "SMS_RECEIVED":
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case "EMAIL_SENT":
      case "EMAIL_RECEIVED":
        return (
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case "CALL_COMPLETED":
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
        );
      case "STATUS_CHANGE":
        return (
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
        );
      case "APPOINTMENT_BOOKED":
      case "APPOINTMENT_CANCELLED":
        return (
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case "NOTE_ADDED":
        return (
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case "SMS_SENT":
        return "SMS Sent";
      case "SMS_RECEIVED":
        return "SMS Received";
      case "EMAIL_SENT":
        return "Email Sent";
      case "EMAIL_RECEIVED":
        return "Email Received";
      case "STATUS_CHANGE":
        return "Status Change";
      case "CALL_COMPLETED":
        return "Call Completed";
      case "APPOINTMENT_BOOKED":
        return "Appointment Booked";
      case "APPOINTMENT_CANCELLED":
        return "Appointment Cancelled";
      case "NOTE_ADDED":
        return "Note Added";
      default:
        return type.replace(/_/g, " ");
    }
  };

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "SMS", value: "sms" },
    { label: "Email", value: "email" },
    { label: "Notes", value: "notes" },
    { label: "Calls", value: "calls" },
    { label: "Status", value: "status" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <DashboardHeader subtitle="Activity Feed" />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1C1B1A]">Activity Feed</h1>
          <p className="text-sm text-[#55514D] mt-1">
            Recent communications and updates across all leads
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                filter === f.value
                  ? "bg-[#625FFF] text-white"
                  : "bg-white text-[#55514D] border border-[#E5E0D8] hover:border-[#625FFF]/30 hover:text-[#1C1B1A]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Activity List */}
        <div className="bg-white rounded-xl border border-[#E5E0D8] shadow-sm overflow-hidden">
          {filteredActivities.length === 0 && !isLoading ? (
            <div className="px-6 py-16 text-center">
              <svg
                className="w-12 h-12 text-[#E5E0D8] mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-[#8E8983]">No activity found</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E0D8]">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 px-6 py-4 hover:bg-[#FAFAF9]/50 transition-colors"
                >
                  {getActivityIcon(activity.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[#8E8983] uppercase tracking-wide">
                        {getActivityLabel(activity.type)}
                      </span>
                      <span className="text-[#D1CDC7]">·</span>
                      <span className="text-xs text-[#8E8983]" title={formatFullDate(activity.createdAt)}>
                        {formatTimeAgo(activity.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[#1C1B1A] mb-1.5">
                      {activity.content || activity.subject || getActivityLabel(activity.type)}
                    </p>
                    <Link
                      href={`/dashboard?lead=${activity.leadId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#625FFF] hover:text-[#524DD9] transition-colors"
                    >
                      {activity.leadName}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More / Loading Indicator */}
          <div ref={loadMoreRef} className="px-6 py-4">
            {isLoading && (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-[#625FFF] border-t-transparent rounded-full"></div>
                <span className="text-sm text-[#8E8983]">Loading...</span>
              </div>
            )}
            {!isLoading && !hasMore && filteredActivities.length > 0 && (
              <p className="text-center text-sm text-[#8E8983]">No more activity to load</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
