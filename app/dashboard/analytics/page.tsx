"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "../logout-button";


interface OverviewData {
  totalLeads: number;
  totalPipelineValue: number;
  conversionRate: number;
  callsScheduled: number;
  callsCompleted: number;
  showUpRate: number;
  responseRate: number;
  avgTimeToResponse: number;
  convertedCount: number;
  activeLeadsCount: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  // New KPIs
  leadToCallRate: number;
  leadToAppRate: number;
  callToAppRate: number;
}

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  color: string;
  conversionRate: number;
  dropOff: number;
}

interface FunnelData {
  funnel: FunnelStage[];
  metrics: {
    contactRate: string;
    engagementRate: string;
    bookingRate: string;
    conversionRate: string;
    dealsWonRate?: string;
  };
  targets?: {
    contactRate: number;
    engagementRate: number;
    bookingRate: number;
    conversionRate: number;
    dealsWonRate: number;
  };
  totalLeads: number;
  lostLeads: number;
}

interface TopLead {
  id: string;
  name: string;
  status: string;
  loanAmount: number;
  loanType: string;
  city: string;
  lastContactedAt: Date | null;
}

interface TopLeadsData {
  topLeads: TopLead[];
  totalValue: number;
  count: number;
}

interface WeeklyMetrics {
  metrics: {
    directBookingRate: { value: number; target: number; status: string; count: number; total: number };
    hollyResponseRate: { value: number; target: number; status: string; count: number; total: number };
    callToAppRate: { value: number; target: number; status: string; count: number; total: number };
    noShowRate: { value: number; target: number; status: string; count: number; total: number };
    cohortPerformance: Array<{
      month: string;
      totalLeads: number;
      completedCalls: number;
      conversions: number;
      dealsWon: number;
      callRate: number;
      conversionRate: number;
      dealsWonRate: number;
    }>;
  };
  funnel: {
    totalLeads: number;
    contacted: number;
    completedCalls: number;
    appsStarted: number;
    appsCompleted: number;
    contactRate: number;
    callBookingRate: number;
    appStartRate: number;
    appCompleteRate: number;
    overallConversionRate: number;
  };
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [topLeads, setTopLeads] = useState<TopLeadsData | null>(null);
  const [weeklyMetrics, setWeeklyMetrics] = useState<WeeklyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTargets, setEditingTargets] = useState(false);
  const [targets, setTargets] = useState({
    contactRateTarget: 80,
    engagementRateTarget: 60,
    bookingRateTarget: 40,
    conversionRateTarget: 20,
    dealsWonRateTarget: 70,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [overviewRes, funnelRes, topLeadsRes, metricsRes] = await Promise.all([
        fetch("/api/analytics/overview"),
        fetch("/api/analytics/funnel"),
        fetch("/api/analytics/top-leads"),
        fetch("/api/analytics/metrics"),
      ]);

      const overviewData = await overviewRes.json();
      const funnelData = await funnelRes.json();
      const topLeadsData = await topLeadsRes.json();
      const metricsData = await metricsRes.json();

      if (overviewData.success) setOverview(overviewData.data);
      if (funnelData.success) {
        setFunnel(funnelData.data);
        // Set targets from API response
        if (funnelData.data.targets) {
          setTargets({
            contactRateTarget: funnelData.data.targets.contactRate,
            engagementRateTarget: funnelData.data.targets.engagementRate,
            bookingRateTarget: funnelData.data.targets.bookingRate,
            conversionRateTarget: funnelData.data.targets.conversionRate,
            dealsWonRateTarget: funnelData.data.targets.dealsWonRate,
          });
        }
      }
      if (topLeadsData.success) setTopLeads(topLeadsData.data);
      if (metricsData) setWeeklyMetrics(metricsData);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveTargets = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/analytics/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targets),
      });

      const data = await res.json();
      if (data.success) {
        setEditingTargets(false);
        // Refresh analytics to show new targets
        await fetchAnalytics();
      } else {
        alert("Failed to save targets: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to save targets:", error);
      alert("Failed to save targets");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Helper to get color based on metric vs target
  const getMetricColor = (value: number, target: number, higherIsBetter: boolean = true) => {
    if (higherIsBetter) {
      if (value >= target) return "text-green-600";
      if (value >= target * 0.8) return "text-yellow-600";
      return "text-red-600";
    } else {
      if (value <= target) return "text-green-600";
      if (value <= target * 1.2) return "text-yellow-600";
      return "text-red-600";
    }
  };

  const getMetricBg = (value: number, target: number, higherIsBetter: boolean = true) => {
    if (higherIsBetter) {
      if (value >= target) return "bg-green-50 border-green-200";
      if (value >= target * 0.8) return "bg-yellow-50 border-yellow-200";
      return "bg-red-50 border-red-200";
    } else {
      if (value <= target) return "bg-green-50 border-green-200";
      if (value <= target * 1.2) return "bg-yellow-50 border-yellow-200";
      return "bg-red-50 border-red-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30 flex items-center justify-center">
        <div className="text-2xl text-[#1C1B1A]">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-[#E4DDD3]">
        <div className="max-w-full mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-[#1C1B1A]">
                <span className="italic text-[#625FFF]">inspired</span>{" "}
                <span className="font-bold">mortgage.</span>
              </h1>
              <p className="text-[#55514D] mt-2 text-lg">Analytics Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm text-[#625FFF] border border-[#625FFF] rounded-md hover:bg-[#625FFF] hover:text-white transition-colors"
              >
                ← Pipeline
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-8 py-8">
        {/* Weekly Performance Scorecard */}
        {weeklyMetrics && (
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1C1B1A] mb-2">Weekly Performance Scorecard</h2>
              <p className="text-sm text-[#55514D]">Track the 5 key metrics that drive conversions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Direct Booking Rate */}
              <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(weeklyMetrics.metrics.directBookingRate.value, weeklyMetrics.metrics.directBookingRate.target)}`}>
                <div className="text-sm text-[#55514D] font-medium mb-2">Direct Booking Rate</div>
                <div className={`text-4xl font-bold ${getMetricColor(weeklyMetrics.metrics.directBookingRate.value, weeklyMetrics.metrics.directBookingRate.target)}`}>
                  {weeklyMetrics.metrics.directBookingRate.value}%
                </div>
                <div className="text-xs text-[#55514D] mt-2">
                  Target: {weeklyMetrics.metrics.directBookingRate.target}% • {weeklyMetrics.metrics.directBookingRate.count} of {weeklyMetrics.metrics.directBookingRate.total} leads
                </div>
              </div>

              {/* Holly Response Rate */}
              <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(weeklyMetrics.metrics.hollyResponseRate.value, weeklyMetrics.metrics.hollyResponseRate.target)}`}>
                <div className="text-sm text-[#55514D] font-medium mb-2">Holly Response Rate</div>
                <div className={`text-4xl font-bold ${getMetricColor(weeklyMetrics.metrics.hollyResponseRate.value, weeklyMetrics.metrics.hollyResponseRate.target)}`}>
                  {weeklyMetrics.metrics.hollyResponseRate.value}%
                </div>
                <div className="text-xs text-[#55514D] mt-2">
                  Target: {weeklyMetrics.metrics.hollyResponseRate.target}% • {weeklyMetrics.metrics.hollyResponseRate.count} of {weeklyMetrics.metrics.hollyResponseRate.total} non-direct leads
                </div>
              </div>

              {/* Call-to-App Rate */}
              <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(weeklyMetrics.metrics.callToAppRate.value, weeklyMetrics.metrics.callToAppRate.target)}`}>
                <div className="text-sm text-[#55514D] font-medium mb-2">Call-to-App Rate</div>
                <div className={`text-4xl font-bold ${getMetricColor(weeklyMetrics.metrics.callToAppRate.value, weeklyMetrics.metrics.callToAppRate.target)}`}>
                  {weeklyMetrics.metrics.callToAppRate.value}%
                </div>
                <div className="text-xs text-[#55514D] mt-2">
                  Target: {weeklyMetrics.metrics.callToAppRate.target}% • {weeklyMetrics.metrics.callToAppRate.count} of {weeklyMetrics.metrics.callToAppRate.total} completed calls
                </div>
              </div>

              {/* No-Show Rate */}
              <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(weeklyMetrics.metrics.noShowRate.value, weeklyMetrics.metrics.noShowRate.target, false)}`}>
                <div className="text-sm text-[#55514D] font-medium mb-2">No-Show Rate</div>
                <div className={`text-4xl font-bold ${getMetricColor(weeklyMetrics.metrics.noShowRate.value, weeklyMetrics.metrics.noShowRate.target, false)}`}>
                  {weeklyMetrics.metrics.noShowRate.value}%
                </div>
                <div className="text-xs text-[#55514D] mt-2">
                  Target: &lt;{weeklyMetrics.metrics.noShowRate.target}% • {weeklyMetrics.metrics.noShowRate.count} of {weeklyMetrics.metrics.noShowRate.total} scheduled
                </div>
              </div>
            </div>

            {/* Cohort Performance Table */}
            {weeklyMetrics.metrics.cohortPerformance.length > 0 && (
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
                <h3 className="text-lg font-bold text-[#1C1B1A] mb-4">Cohort Performance by Month</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E4DDD3]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Month</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Total Leads</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Completed Calls</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Call Rate</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Conversions</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Conversion Rate</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Deals Won</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Won Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyMetrics.metrics.cohortPerformance.map((cohort) => (
                        <tr key={cohort.month} className="border-b border-[#E4DDD3]/50 hover:bg-[#FBF3E7]/30">
                          <td className="py-3 px-4 text-sm font-semibold text-[#1C1B1A]">{cohort.month}</td>
                          <td className="py-3 px-4 text-sm text-[#55514D]">{cohort.totalLeads}</td>
                          <td className="py-3 px-4 text-sm text-[#55514D]">{cohort.completedCalls}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-[#625FFF]">{cohort.callRate.toFixed(1)}%</td>
                          <td className="py-3 px-4 text-sm text-[#55514D]">{cohort.conversions}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-[#625FFF]">{cohort.conversionRate.toFixed(1)}%</td>
                          <td className="py-3 px-4 text-sm text-[#2E7D32] font-semibold">{cohort.dealsWon}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-[#2E7D32]">{cohort.dealsWonRate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5 Core Performance Metrics */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#1C1B1A] mb-2">Core Performance Metrics</h2>
          <p className="text-sm text-[#55514D]">Key indicators of system health and conversion effectiveness</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* KPI 1: Lead-to-Call Rate */}
          <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(overview?.leadToCallRate || 0, 18)}`}>
            <div className="text-sm text-[#55514D] font-medium mb-2">Lead-to-Call</div>
            <div className={`text-4xl font-bold ${getMetricColor(overview?.leadToCallRate || 0, 18)}`}>
              {overview?.leadToCallRate || 0}%
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              Target: 18% • {overview?.callsScheduled || 0} of {overview?.totalLeads || 0}
            </div>
          </div>

          {/* KPI 2: Response Rate */}
          <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(overview?.responseRate || 0, 35)}`}>
            <div className="text-sm text-[#55514D] font-medium mb-2">Response Rate</div>
            <div className={`text-4xl font-bold ${getMetricColor(overview?.responseRate || 0, 35)}`}>
              {overview?.responseRate || 0}%
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              Target: 35% • Replied to Holly
            </div>
          </div>

          {/* KPI 3: Call-to-App Rate */}
          <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(overview?.callToAppRate || 0, 45)}`}>
            <div className="text-sm text-[#55514D] font-medium mb-2">Call-to-App</div>
            <div className={`text-4xl font-bold ${getMetricColor(overview?.callToAppRate || 0, 45)}`}>
              {overview?.callToAppRate || 0}%
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              Target: 45% • Apps from calls
            </div>
          </div>

          {/* KPI 4: Direct Booking Rate */}
          <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${weeklyMetrics ? getMetricBg(weeklyMetrics.metrics.directBookingRate.value, weeklyMetrics.metrics.directBookingRate.target) : 'bg-white/90 border-[#E4DDD3]'}`}>
            <div className="text-sm text-[#55514D] font-medium mb-2">Direct Booking</div>
            <div className={`text-4xl font-bold ${weeklyMetrics ? getMetricColor(weeklyMetrics.metrics.directBookingRate.value, weeklyMetrics.metrics.directBookingRate.target) : 'text-[#1C1B1A]'}`}>
              {weeklyMetrics?.metrics.directBookingRate.value || 0}%
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              Target: {weeklyMetrics?.metrics.directBookingRate.target || 25}% • LOD bookings
            </div>
          </div>

          {/* KPI 5: Holly Booking Rate */}
          <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${weeklyMetrics ? getMetricBg(weeklyMetrics.metrics.hollyResponseRate.value, weeklyMetrics.metrics.hollyResponseRate.target) : 'bg-white/90 border-[#E4DDD3]'}`}>
            <div className="text-sm text-[#55514D] font-medium mb-2">Holly Booking</div>
            <div className={`text-4xl font-bold ${weeklyMetrics ? getMetricColor(weeklyMetrics.metrics.hollyResponseRate.value, weeklyMetrics.metrics.hollyResponseRate.target) : 'text-[#1C1B1A]'}`}>
              {weeklyMetrics?.metrics.hollyResponseRate.value || 0}%
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              Target: {weeklyMetrics?.metrics.hollyResponseRate.target || 40}% • Non-direct
            </div>
          </div>
        </div>

        {/* Supporting Metrics */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#1C1B1A] mb-2">Supporting Metrics</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <div className="text-sm text-[#55514D] font-medium mb-2">Total Leads</div>
            <div className="text-3xl font-bold text-[#1C1B1A]">{overview?.totalLeads || 0}</div>
            <div className="text-xs text-[#55514D] mt-2">
              {overview?.activeLeadsCount || 0} active, {overview?.convertedCount || 0} converted
            </div>
          </div>

          <div className={`backdrop-blur-sm rounded-xl shadow-sm border-2 p-6 ${getMetricBg(overview?.showUpRate || 0, 75)}`}>
            <div className="text-sm text-[#55514D] font-medium mb-2">Show-Up Rate</div>
            <div className={`text-3xl font-bold ${getMetricColor(overview?.showUpRate || 0, 75)}`}>
              {overview?.showUpRate || 0}%
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              Target: 75% • {overview?.callsCompleted || 0} of {overview?.callsScheduled || 0} calls
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <div className="text-sm text-[#55514D] font-medium mb-2">Active Pipeline Value</div>
            <div className="text-3xl font-bold text-[#625FFF]">
              {formatCurrency((overview as any)?.activePipelineValue || overview?.totalPipelineValue || 0)}
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              {overview?.activeLeadsCount || 0} active leads (excludes lost/won)
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <div className="text-sm text-[#55514D] font-medium mb-2">Avg. Days in Stage</div>
            <div className="text-3xl font-bold text-[#1C1B1A]">
              {(overview as any)?.avgDaysInStage ? `${(overview as any).avgDaysInStage.toFixed(1)}` : "0.0"}
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              {(overview as any)?.leadsStuck || 0} leads stuck (&gt;7 days)
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <div className="text-sm text-[#55514D] font-medium mb-2">Avg. Time to Reply</div>
            <div className="text-3xl font-bold text-[#1C1B1A]">
              {overview?.avgTimeToResponse ? `${overview.avgTimeToResponse.toFixed(1)}h` : "N/A"}
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              Target: &lt;24h • Lead response speed
            </div>
          </div>
        </div>


        {/* Conversion Funnel */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#1C1B1A]">Conversion Funnel</h2>
            <button
              onClick={() => setEditingTargets(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-[#625FFF] rounded-md hover:bg-[#524DD9] transition-colors"
            >
              Edit Targets
            </button>
          </div>
          <div className="space-y-4">
            {funnel?.funnel.map((stage, index) => {
              const maxCount = funnel.funnel[0]?.count || 1;
              const widthPercent = (stage.count / maxCount) * 100;

              return (
                <div key={stage.stage} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-[#1C1B1A]">{stage.label}</div>
                    <div className="text-sm text-[#55514D]">
                      {stage.count} leads ({stage.conversionRate}%)
                    </div>
                  </div>
                  <div className="w-full bg-[#E4DDD3] rounded-full h-8 relative overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 flex items-center justify-end px-4"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: stage.color,
                      }}
                    >
                      {stage.count > 0 && (
                        <span className="text-sm font-bold text-[#1C1B1A]">{stage.count}</span>
                      )}
                    </div>
                  </div>
                  {index > 0 && stage.dropOff > 0 && (
                    <div className="text-xs text-red-600 mt-1">↓ {stage.dropOff.toFixed(1)}% drop-off</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-[#E4DDD3]">
            <div>
              <div className="text-xs text-[#55514D]">Contact Rate</div>
              <div className="text-xl font-bold text-[#625FFF]">
                {funnel?.metrics.contactRate || 0}%
              </div>
              <div className="text-xs text-[#55514D] mt-1">
                Target: {funnel?.targets?.contactRate || 80}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#55514D]">Engagement Rate</div>
              <div className="text-xl font-bold text-[#625FFF]">
                {funnel?.metrics.engagementRate || 0}%
              </div>
              <div className="text-xs text-[#55514D] mt-1">
                Target: {funnel?.targets?.engagementRate || 60}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#55514D]">Booking Rate</div>
              <div className="text-xl font-bold text-[#625FFF]">
                {funnel?.metrics.bookingRate || 0}%
              </div>
              <div className="text-xs text-[#55514D] mt-1">
                Target: {funnel?.targets?.bookingRate || 40}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#55514D]">Conversion Rate</div>
              <div className="text-xl font-bold text-[#625FFF]">
                {funnel?.metrics.conversionRate || 0}%
              </div>
              <div className="text-xs text-[#55514D] mt-1">
                Target: {funnel?.targets?.conversionRate || 20}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#55514D]">Deals Won Rate</div>
              <div className="text-xl font-bold text-[#2E7D32]">
                {funnel?.metrics.dealsWonRate || 0}%
              </div>
              <div className="text-xs text-[#55514D] mt-1">
                Target: {funnel?.targets?.dealsWonRate || 70}%
              </div>
            </div>
          </div>
        </div>

        {/* Edit Targets Modal */}
        {editingTargets && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-[#1C1B1A] mb-4">Edit Conversion Targets</h3>
              <p className="text-sm text-[#55514D] mb-6">
                Set your target conversion rates for each stage of the funnel
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">
                    Contact Rate Target (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={targets.contactRateTarget}
                    onChange={(e) =>
                      setTargets({ ...targets, contactRateTarget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#625FFF]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">
                    Engagement Rate Target (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={targets.engagementRateTarget}
                    onChange={(e) =>
                      setTargets({ ...targets, engagementRateTarget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#625FFF]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">
                    Booking Rate Target (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={targets.bookingRateTarget}
                    onChange={(e) =>
                      setTargets({ ...targets, bookingRateTarget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#625FFF]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">
                    Conversion Rate Target (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={targets.conversionRateTarget}
                    onChange={(e) =>
                      setTargets({ ...targets, conversionRateTarget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#625FFF]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1C1B1A] mb-1">
                    Deals Won Rate Target (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={targets.dealsWonRateTarget}
                    onChange={(e) =>
                      setTargets({ ...targets, dealsWonRateTarget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-[#E4DDD3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#625FFF]"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingTargets(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-[#55514D] border border-[#E4DDD3] rounded-md hover:bg-[#FBF3E7] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTargets}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#625FFF] rounded-md hover:bg-[#524DD9] transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Targets"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Leads by Value */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#1C1B1A]">Top Leads by Value</h2>
            <div className="text-sm text-[#55514D]">
              Total: {formatCurrency(topLeads?.totalValue || 0)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E4DDD3]">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Loan Amount
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Location
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Last Contact
                  </th>
                </tr>
              </thead>
              <tbody>
                {topLeads?.topLeads.slice(0, 10).map((lead) => (
                  <tr key={lead.id} className="border-b border-[#E4DDD3]/50 hover:bg-[#FBF3E7]/30">
                    <td className="py-3 px-4 text-sm text-[#1C1B1A] font-medium">{lead.name}</td>
                    <td className="py-3 px-4 text-sm text-[#625FFF] font-bold">
                      {formatCurrency(lead.loanAmount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D] capitalize">
                      {lead.loanType}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D]">{lead.city}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-[#B1AFFF]/20 text-[#625FFF]">
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D]">
                      {lead.lastContactedAt
                        ? new Date(lead.lastContactedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
