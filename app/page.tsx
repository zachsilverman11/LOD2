"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  buildLeadDetailHref,
  getLeadDetailTabForActivityType,
} from "@/lib/lead-detail-routing";

interface QuickStats {
  activeLeads: number;
  callsScheduled: number;
  awaitingApplication: number;
  dealsWon: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  leadName: string;
  leadId: string;
  createdAt: string;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status]);

  const fetchDashboardData = async () => {
    try {
      const [overviewRes, activityRes] = await Promise.all([
        fetch("/api/analytics/overview"),
        fetch("/api/activity/recent?limit=5"),
      ]);

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        if (overviewData.success && overviewData.data) {
          const statusBreakdown = overviewData.data.statusBreakdown || [];
          const findCount = (statuses: string[]) =>
            statusBreakdown
              .filter((s: { status: string }) => statuses.includes(s.status))
              .reduce((sum: number, s: { count: number }) => sum + s.count, 0);

          setStats({
            activeLeads: findCount([
              "NEW",
              "CONTACTED",
              "ENGAGED",
              "CALL_SCHEDULED",
              "CALL_COMPLETED",
              "WAITING_FOR_APPLICATION",
              "APPLICATION_STARTED",
            ]),
            callsScheduled: findCount(["CALL_SCHEDULED"]),
            awaitingApplication: findCount(["WAITING_FOR_APPLICATION"]),
            dealsWon: overviewData.data.keyMetrics?.dealsWon || 0,
          });
        }
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivities(activityData.slice(0, 5));
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getFirstName = () => {
    if (session?.user?.name) {
      return session.user.name.split(" ")[0];
    }
    return session?.user?.email?.split("@")[0] || "there";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "SMS_SENT":
      case "SMS_RECEIVED":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        );
      case "EMAIL_SENT":
      case "EMAIL_RECEIVED":
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case "CALL_SCHEDULED":
      case "CALL_COMPLETED":
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
        );
      case "STATUS_CHANGE":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
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

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#FAFAF9]">
        <DashboardHeader subtitle="Home" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-pulse text-[#55514D]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <DashboardHeader subtitle="Home" />

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1C1B1A]">
            {getGreeting()}, {getFirstName()}
          </h1>
          <p className="text-[#55514D] mt-1">
            Here&apos;s what&apos;s happening with your leads today
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E5E0D8] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#55514D]">Active Leads</span>
              <div className="w-8 h-8 rounded-full bg-[#625FFF]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#625FFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-[#1C1B1A]">
              {loading ? "..." : stats?.activeLeads || 0}
            </p>
            <p className="text-xs text-[#55514D] mt-1">In pipeline</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E5E0D8] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#55514D]">Calls Scheduled</span>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-[#1C1B1A]">
              {loading ? "..." : stats?.callsScheduled || 0}
            </p>
            <p className="text-xs text-[#55514D] mt-1">Pending calls</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E5E0D8] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#55514D]">Awaiting App</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-[#1C1B1A]">
              {loading ? "..." : stats?.awaitingApplication || 0}
            </p>
            <p className="text-xs text-[#55514D] mt-1">Need follow-up</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E5E0D8] hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#55514D]">Deals Won</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              {loading ? "..." : stats?.dealsWon || 0}
            </p>
            <p className="text-xs text-[#55514D] mt-1">Total closed</p>
          </div>
        </div>

        {/* Quick Actions + Recent Activity */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-[#1C1B1A]">Quick Actions</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Primary: Pipeline */}
              <Link
                href="/dashboard"
                className="group relative bg-gradient-to-br from-[#625FFF] to-[#8B88FF] rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">View Pipeline</h3>
                  <p className="text-sm text-white/80">Manage leads in Kanban view</p>
                </div>
              </Link>

              {/* Secondary: Analytics */}
              <Link
                href="/dashboard/analytics"
                className="group bg-white rounded-xl p-6 shadow-sm border border-[#E5E0D8] hover:shadow-lg hover:border-[#625FFF]/30 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-[#625FFF]/10 flex items-center justify-center mb-4 group-hover:bg-[#625FFF]/20 transition-colors">
                  <svg className="w-6 h-6 text-[#625FFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#1C1B1A] mb-1 group-hover:text-[#625FFF] transition-colors">Analytics</h3>
                <p className="text-sm text-[#55514D]">Conversion metrics & funnels</p>
              </Link>

              {/* Tertiary: Dev Board */}
              <Link
                href="/dev-board"
                className="group bg-white rounded-xl p-6 shadow-sm border border-[#E5E0D8] hover:shadow-lg hover:border-[#625FFF]/30 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-[#625FFF]/10 transition-colors">
                  <svg className="w-6 h-6 text-[#55514D] group-hover:text-[#625FFF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#1C1B1A] mb-1 group-hover:text-[#625FFF] transition-colors">Dev Board</h3>
                <p className="text-sm text-[#55514D]">Features & bug tracking</p>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E0D8] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E0D8]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#1C1B1A]">Recent Activity</h2>
                <Link
                  href="/dashboard"
                  className="text-sm text-[#625FFF] hover:text-[#524DD9] font-medium"
                >
                  View all
                </Link>
              </div>
            </div>
            <div className="divide-y divide-[#E5E0D8]">
              {loading ? (
                <div className="px-5 py-8 text-center text-[#55514D]">
                  Loading activity...
                </div>
              ) : activities.length === 0 ? (
                <div className="px-5 py-8 text-center text-[#55514D]">
                  No recent activity
                </div>
              ) : (
                activities.map((activity) => (
                  <Link
                    key={activity.id}
                    href={buildLeadDetailHref(
                      activity.leadId,
                      getLeadDetailTabForActivityType(activity.type)
                    )}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-[#FAFAF9] transition-colors"
                  >
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1C1B1A] truncate">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-[#625FFF]">
                          {activity.leadName}
                        </span>
                        <span className="text-xs text-[#8E8983]">
                          {formatTimeAgo(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[#E5E0D8] text-center">
          <p className="text-sm text-[#8E8983]">
            Powered by Holly AI &bull; Built for Inspired Mortgage
          </p>
        </div>
      </main>
    </div>
  );
}
