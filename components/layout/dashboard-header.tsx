"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/providers/theme-provider";

interface DashboardHeaderProps {
  subtitle?: string;
}

interface Activity {
  id: string;
  type: string;
  content?: string;
  subject?: string;
  leadName: string;
  leadId: string;
  createdAt: string;
}

export function DashboardHeader({ subtitle }: DashboardHeaderProps) {
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityCount, setActivityCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);

  // Filter function for user-relevant activities
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

    const content = (activity.content || "");
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

  const fetchActivities = useCallback(async () => {
    setActivityLoading(true);
    try {
      const res = await fetch("/api/activity/recent?limit=20");
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        const activityList = Array.isArray(data) ? data : [];
        setActivities(activityList);
        // Update count based on filtered activities
        const filtered = activityList.filter(isUserRelevantActivity);
        setActivityCount(filtered.length);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setActivityLoading(false);
    }
  }, [isUserRelevantActivity]);

  // Fetch activities on mount for badge count
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Refetch when dropdown opens
  useEffect(() => {
    if (activityOpen) {
      fetchActivities();
    }
  }, [activityOpen, fetchActivities]);

  // Get filtered activities for display
  const filteredActivities = activities.filter(isUserRelevantActivity);

  // Generate description from activity data
  const getActivityDescription = (activity: Activity) => {
    switch (activity.type) {
      case "SMS_SENT":
        return activity.content ? `Sent: "${activity.content.slice(0, 50)}${activity.content.length > 50 ? '...' : ''}"` : "SMS sent";
      case "SMS_RECEIVED":
        return activity.content ? `Received: "${activity.content.slice(0, 50)}${activity.content.length > 50 ? '...' : ''}"` : "SMS received";
      case "EMAIL_SENT":
        return activity.subject || "Email sent";
      case "EMAIL_RECEIVED":
        return activity.subject || "Email received";
      case "STATUS_CHANGE":
        return activity.content || "Status changed";
      case "CALL_COMPLETED":
        return "Call completed";
      case "APPOINTMENT_BOOKED":
        return "Appointment booked";
      case "APPOINTMENT_CANCELLED":
        return "Appointment cancelled";
      case "NOTE_ADDED":
        return activity.content ? `Note: "${activity.content.slice(0, 50)}${activity.content.length > 50 ? '...' : ''}"` : "Note added";
      default:
        return activity.content || activity.type.replace(/_/g, " ").toLowerCase();
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (activityRef.current && !activityRef.current.contains(event.target as Node)) {
        setActivityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const navLinks = [
    { href: "/dashboard", label: "Pipeline" },
    { href: "/dashboard/analytics", label: "Analytics" },
    { href: "/dashboard/admin", label: "Admin" },
    { href: "/dev-board", label: "Dev Board" },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

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
    return `${diffDays}d ago`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "SMS_SENT":
      case "SMS_RECEIVED":
        return (
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case "EMAIL_SENT":
      case "EMAIL_RECEIVED":
        return (
          <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case "CALL_SCHEDULED":
      case "CALL_COMPLETED":
        return (
          <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
        );
      case "STATUS_CHANGE":
        return (
          <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
        );
      case "NOTE_ADDED":
        return (
          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-[#E5E0D8] dark:border-gray-700 shadow-sm">
      <div className="max-w-full mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex flex-col">
              <h1 className="text-2xl font-extrabold text-[#1C1B1A] dark:text-gray-100 tracking-tight">
                <span className="italic text-[#625FFF] group-hover:text-[#524DD9] transition-colors">
                  inspired
                </span>{" "}
                <span className="font-bold">mortgage.</span>
              </h1>
              {subtitle && (
                <span className="text-xs text-[#55514D] dark:text-gray-400 font-medium -mt-0.5">
                  {subtitle}
                </span>
              )}
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive(link.href)
                    ? "text-[#625FFF] bg-[#625FFF]/5 dark:bg-[#625FFF]/10"
                    : "text-[#55514D] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100 hover:bg-[#F5F3F0] dark:hover:bg-gray-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Section: Activity + User Menu */}
          <div className="flex items-center gap-2">
            {/* Activity Bell */}
            <div className="relative" ref={activityRef}>
              <button
                onClick={() => setActivityOpen(!activityOpen)}
                className={`relative p-2 rounded-lg transition-colors duration-200 ${
                  activityOpen
                    ? "bg-[#625FFF]/10 text-[#625FFF]"
                    : "text-[#55514D] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100 hover:bg-[#F5F3F0] dark:hover:bg-gray-800"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {/* Badge */}
                {activityCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#625FFF] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activityCount > 9 ? "9+" : activityCount}
                  </span>
                )}
              </button>

              {/* Activity Dropdown */}
              {activityOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-[#E5E0D8] dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[#E5E0D8] dark:border-gray-700 bg-[#FAFAF9] dark:bg-gray-800/50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#1C1B1A] dark:text-gray-100">Recent Activity</h3>
                      <button
                        onClick={() => fetchActivities()}
                        className="text-xs text-[#625FFF] hover:text-[#524DD9] font-medium"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Activity List */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {activityLoading ? (
                      <div className="px-4 py-8 text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-[#625FFF] border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-xs text-[#8E8983] dark:text-gray-500 mt-2">Loading...</p>
                      </div>
                    ) : filteredActivities.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <svg className="w-10 h-10 text-[#E5E0D8] dark:text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-sm text-[#8E8983] dark:text-gray-500">No recent activity</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E5E0D8] dark:divide-gray-700">
                        {filteredActivities.slice(0, 10).map((activity) => (
                          <Link
                            key={activity.id}
                            href={`/dashboard?lead=${activity.leadId}`}
                            onClick={() => setActivityOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAF9] dark:hover:bg-gray-700/50 transition-colors"
                          >
                            {getActivityIcon(activity.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#1C1B1A] dark:text-gray-100 line-clamp-1">
                                {getActivityDescription(activity)}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-medium text-[#625FFF] truncate max-w-[150px]">
                                  {activity.leadName}
                                </span>
                                <span className="text-[10px] text-[#8E8983] dark:text-gray-500">
                                  {formatTimeAgo(activity.createdAt)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {filteredActivities.length > 0 && (
                    <div className="px-4 py-3 border-t border-[#E5E0D8] dark:border-gray-700 bg-[#FAFAF9] dark:bg-gray-800/50">
                      <Link
                        href="/dashboard/activity"
                        onClick={() => setActivityOpen(false)}
                        className="text-xs text-[#625FFF] hover:text-[#524DD9] font-medium"
                      >
                        View all activity →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg text-[#55514D] hover:text-[#1C1B1A] hover:bg-[#F5F3F0] dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedTheme === "dark" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-[#E5E0D8] dark:bg-gray-700 mx-1"></div>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-[#F5F3F0] dark:hover:bg-gray-800 transition-colors duration-200 border border-transparent hover:border-[#E5E0D8] dark:hover:border-gray-700"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#625FFF] to-[#8B88FF] flex items-center justify-center shadow-sm">
                  <span className="text-xs font-semibold text-white">
                    {getInitials(session?.user?.name, session?.user?.email)}
                  </span>
                </div>
                <span className="hidden lg:block text-sm font-medium text-[#1C1B1A] dark:text-gray-100 max-w-[120px] truncate">
                  {session?.user?.name || session?.user?.email?.split("@")[0] || "User"}
                </span>
                <svg
                  className={`w-4 h-4 text-[#55514D] dark:text-gray-400 transition-transform duration-200 ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-[#E5E0D8] dark:border-gray-700 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-[#E5E0D8] dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#625FFF] to-[#8B88FF] flex items-center justify-center shadow-sm">
                        <span className="text-sm font-semibold text-white">
                          {getInitials(session?.user?.name, session?.user?.email)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1C1B1A] dark:text-gray-100 truncate">
                          {session?.user?.name || "User"}
                        </p>
                        <p className="text-xs text-[#55514D] dark:text-gray-400 truncate">
                          {session?.user?.email || ""}
                        </p>
                      </div>
                    </div>
                    {session?.user?.role && (
                      <div className="mt-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            session.user.role === "ADMIN"
                              ? "bg-[#625FFF]/10 text-[#625FFF]"
                              : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {session.user.role === "ADMIN" ? (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Administrator
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                              Advisor
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="py-1">
                    <Link
                      href="/"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[#55514D] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100 hover:bg-[#F5F3F0] dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Home
                    </Link>
                    <Link
                      href="/dashboard/activity"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[#55514D] dark:text-gray-400 hover:text-[#1C1B1A] dark:hover:text-gray-100 hover:bg-[#F5F3F0] dark:hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Activity Feed
                    </Link>
                  </div>

                  <div className="border-t border-[#E5E0D8] dark:border-gray-700 pt-1 mt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
