"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";

interface KeyMetrics {
  totalLeads: number;
  leadsBooked: number;
  appsSubmitted: number;
  dealsWon: number;
  leadToCallBookedRate: number;
  callBookedToAppRate: number;
  appToDealsWonRate: number;
  leadToDealsWonRate: number;
}

interface OverviewData {
  totalLeads: number;
  activePipelineValue: number;
  keyMetrics: KeyMetrics;
  statusBreakdown: Array<{ status: string; count: number }>;
}

interface CohortData {
  cohort: string;
  totalLeads: number;
  booked: number;
  appsSubmitted: number;
  dealsWon: number;
  leadToCallRate: number;
  callToAppRate: number;
  appToDealsWonRate: number;
  leadToDealsWonRate: number;
  startDate: string | null;
}

interface CohortComparisonData {
  cohorts: CohortData[];
  totals: CohortData;
  totalCohorts: number;
}

interface LoanTypeData {
  loanType: string;
  displayName: string;
  totalLeads: number;
  booked: number;
  appsSubmitted: number;
  dealsWon: number;
  leadToCallRate: number;
  appToDealsWonRate: number;
  leadToDealsWonRate: number;
}

interface LoanTypeAnalytics {
  loanTypes: LoanTypeData[];
  totals: LoanTypeData;
}

interface BookingSourceStats {
  source: string;
  displayName: string;
  total: number;
  scheduled: number;
  completed: number;
  noShow: number;
  cancelled: number;
  showUpRate: number;
  conversionRate: number;
}

interface BookingSourceData {
  sources: BookingSourceStats[];
  totals: {
    total: number;
    scheduled: number;
    completed: number;
    noShow: number;
    cancelled: number;
    showUpRate: number;
    conversionRate: number;
  };
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [cohortData, setCohortData] = useState<CohortComparisonData | null>(null);
  const [loanTypeData, setLoanTypeData] = useState<LoanTypeAnalytics | null>(null);
  const [bookingSourceData, setBookingSourceData] = useState<BookingSourceData | null>(null);
  const [loading, setLoading] = useState(true);

  // Cohort filtering
  const [selectedCohort, setSelectedCohort] = useState<string>("all");
  const [availableCohorts, setAvailableCohorts] = useState<string[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const cohortParam = selectedCohort !== "all" ? `?cohort=${selectedCohort}` : "";
      const [overviewRes, cohortRes, loanTypeRes, bookingSourceRes] = await Promise.all([
        fetch(`/api/analytics/overview${cohortParam}`),
        fetch("/api/analytics/cohort-comparison"),
        fetch(`/api/analytics/loan-types${cohortParam}`),
        fetch(`/api/analytics/booking-sources${cohortParam}`),
      ]);

      const overviewData = await overviewRes.json();
      const cohortComparisonData = await cohortRes.json();
      const loanTypeAnalytics = await loanTypeRes.json();
      const bookingSourceAnalytics = await bookingSourceRes.json();

      if (overviewData.success) {
        setOverview(overviewData.data);
      }
      if (cohortComparisonData.success) {
        setCohortData(cohortComparisonData.data);
        // Extract cohort names for filter dropdown
        const cohortNames = cohortComparisonData.data.cohorts.map((c: CohortData) => c.cohort);
        setAvailableCohorts(cohortNames);
      }
      if (loanTypeAnalytics.success) {
        setLoanTypeData(loanTypeAnalytics.data);
      }
      if (bookingSourceAnalytics.success) {
        setBookingSourceData(bookingSourceAnalytics.data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Get key metrics from overview or calculate from cohort data
  const keyMetrics = overview?.keyMetrics || {
    totalLeads: 0,
    leadsBooked: 0,
    appsSubmitted: 0,
    dealsWon: 0,
    leadToCallBookedRate: 0,
    callBookedToAppRate: 0,
    appToDealsWonRate: 0,
    leadToDealsWonRate: 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9]">
        <DashboardHeader subtitle="Analytics" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-pulse text-[#55514D]">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <DashboardHeader subtitle="Analytics" />

      {/* Secondary Toolbar - Cohort Filter */}
      <div className="bg-white border-b border-[#E5E0D8]">
        <div className="max-w-full mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-sm font-medium text-[#55514D]">Filter by Cohort:</label>
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="min-h-11 rounded-lg border border-[#E5E0D8] bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#625FFF]/20 focus:border-[#625FFF] sm:text-sm"
            >
              <option value="all">All Cohorts</option>
              {availableCohorts.map((cohort) => (
                <option key={cohort} value={cohort}>
                  {cohort}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Cohort Filter Indicator */}
        {selectedCohort !== "all" && (
          <div className="mb-6 bg-[#625FFF]/10 border border-[#625FFF] rounded-lg p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-sm font-semibold text-[#625FFF]">
                  Viewing: {selectedCohort}
                </span>
                <span className="text-xs text-[#55514D]">
                  All metrics below are filtered to this cohort only
                </span>
              </div>
              <button
                onClick={() => setSelectedCohort("all")}
                className="text-sm text-[#625FFF] hover:text-[#524DD9] font-medium"
              >
                Clear Filter
              </button>
            </div>
          </div>
        )}

        {/* Section 1: Key Numbers (4 cards) */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-[#1C1B1A] sm:text-2xl">Key Numbers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Leads */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
              <div className="text-sm text-[#55514D] font-medium mb-2">Total Leads</div>
              <div className="text-3xl font-bold text-[#1C1B1A] sm:text-4xl">{overview?.totalLeads || 0}</div>
              <div className="text-xs text-[#55514D] mt-2">
                {keyMetrics.leadsBooked} booked • {keyMetrics.dealsWon} won
              </div>
            </div>

            {/* Active Pipeline Value */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
              <div className="text-sm text-[#55514D] font-medium mb-2">Active Pipeline Value</div>
              <div className="text-3xl font-bold text-[#625FFF] sm:text-4xl">
                {formatCurrency(overview?.activePipelineValue || 0)}
              </div>
              <div className="text-xs text-[#55514D] mt-2">
                Excludes Lost & Deals Won
              </div>
            </div>

            {/* Lead → Call Booked Rate */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
              <div className="text-sm text-[#55514D] font-medium mb-2">Lead → Call Booked</div>
              <div className="text-3xl font-bold text-[#625FFF] sm:text-4xl">
                {formatPercent(keyMetrics.leadToCallBookedRate)}
              </div>
              <div className="text-xs text-[#55514D] mt-2">
                {keyMetrics.leadsBooked} of {keyMetrics.totalLeads} leads
              </div>
            </div>

            {/* Lead → Deals Won Rate (TRUE conversion) */}
            <div className="bg-green-50 backdrop-blur-sm rounded-xl shadow-sm border-2 border-green-200 p-6">
              <div className="text-sm text-green-700 font-medium mb-2">Lead → Deals Won</div>
              <div className="text-3xl font-bold text-green-700 sm:text-4xl">
                {formatPercent(keyMetrics.leadToDealsWonRate)}
              </div>
              <div className="text-xs text-green-600 mt-2">
                {keyMetrics.dealsWon} deals won • TRUE conversion
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Conversion Funnel Rates (4 key rates) */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-[#1C1B1A] sm:text-2xl">Conversion Funnel</h2>
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-6">
              {/* Lead → Call Booked */}
              <div className="text-center p-4 bg-[#625FFF]/5 rounded-lg">
                <div className="text-sm text-[#55514D] mb-2">Lead → Call Booked</div>
                <div className="text-3xl font-bold text-[#625FFF]">
                  {formatPercent(keyMetrics.leadToCallBookedRate)}
                </div>
                <div className="text-xs text-[#55514D] mt-1">
                  {keyMetrics.leadsBooked} / {keyMetrics.totalLeads}
                </div>
              </div>

              {/* Call Booked → Application */}
              <div className="text-center p-4 bg-[#625FFF]/5 rounded-lg">
                <div className="text-sm text-[#55514D] mb-2">Call → Application</div>
                <div className="text-3xl font-bold text-[#625FFF]">
                  {formatPercent(keyMetrics.callBookedToAppRate)}
                </div>
                <div className="text-xs text-[#55514D] mt-1">
                  {keyMetrics.appsSubmitted} / {keyMetrics.leadsBooked}
                </div>
              </div>

              {/* App → Deals Won */}
              <div className="text-center p-4 bg-[#625FFF]/5 rounded-lg">
                <div className="text-sm text-[#55514D] mb-2">App → Won</div>
                <div className="text-3xl font-bold text-[#625FFF]">
                  {formatPercent(keyMetrics.appToDealsWonRate)}
                </div>
                <div className="text-xs text-[#55514D] mt-1">
                  {keyMetrics.dealsWon} / {keyMetrics.appsSubmitted}
                </div>
              </div>

              {/* Lead → Deals Won */}
              <div className="text-center p-4 bg-green-100 rounded-lg border border-green-200">
                <div className="text-sm text-green-700 mb-2">Lead → Deals Won</div>
                <div className="text-3xl font-bold text-green-700">
                  {formatPercent(keyMetrics.leadToDealsWonRate)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {keyMetrics.dealsWon} / {keyMetrics.totalLeads}
                </div>
              </div>
            </div>

            {/* Visual Funnel */}
            <div className="mt-8 border-t border-[#E4DDD3] pt-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                {/* Total Leads */}
                <div className="flex-1">
                  <div className="bg-[#625FFF] text-white rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{keyMetrics.totalLeads}</div>
                    <div className="text-xs opacity-80">Total Leads</div>
                  </div>
                </div>
                <div className="text-center text-[#55514D] lg:text-left">→</div>
                {/* Booked */}
                <div className="flex-1">
                  <div className="bg-[#8B88FF] text-white rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{keyMetrics.leadsBooked}</div>
                    <div className="text-xs opacity-80">Call Booked</div>
                  </div>
                </div>
                <div className="text-center text-[#55514D] lg:text-left">→</div>
                {/* App Submitted */}
                <div className="flex-1">
                  <div className="bg-[#B8E986] text-[#1C1B1A] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{keyMetrics.appsSubmitted}</div>
                    <div className="text-xs opacity-80">App Submitted</div>
                  </div>
                </div>
                <div className="text-center text-[#55514D] lg:text-left">→</div>
                {/* Deals Won */}
                <div className="flex-1">
                  <div className="bg-green-600 text-white rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{keyMetrics.dealsWon}</div>
                    <div className="text-xs opacity-80">Deals Won</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Cohort Performance Table */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-[#1C1B1A] sm:text-2xl">Cohort Performance</h2>
          <div className="space-y-3 md:hidden">
            {cohortData?.cohorts.map((cohort) => (
              <div
                key={cohort.cohort}
                className="rounded-xl border border-[#E4DDD3] bg-white/90 p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[#625FFF]">{cohort.cohort}</p>
                    <p className="text-xs text-[#8E8983]">
                      {cohort.startDate
                        ? new Date(cohort.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No start date"}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                    {formatPercent(cohort.leadToDealsWonRate)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#8E8983]">Total Leads</p>
                    <p className="font-semibold text-[#1C1B1A]">{cohort.totalLeads}</p>
                  </div>
                  <div>
                    <p className="text-[#8E8983]">Booked</p>
                    <p className="font-semibold text-[#1C1B1A]">
                      {cohort.booked} ({formatPercent(cohort.leadToCallRate)})
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8E8983]">Apps</p>
                    <p className="font-semibold text-[#1C1B1A]">
                      {cohort.appsSubmitted} ({formatPercent(cohort.callToAppRate)})
                    </p>
                  </div>
                  <div>
                    <p className="text-[#8E8983]">Deals Won</p>
                    <p className="font-semibold text-green-700">
                      {cohort.dealsWon} ({formatPercent(cohort.appToDealsWonRate)})
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {cohortData?.totals && (
              <div className="rounded-xl bg-[#1C1B1A] p-4 text-white shadow-sm">
                <p className="text-sm font-semibold">Totals</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/60">Leads</p>
                    <p className="font-semibold">{cohortData.totals.totalLeads}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Booked</p>
                    <p className="font-semibold">{cohortData.totals.booked}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Apps</p>
                    <p className="font-semibold">{cohortData.totals.appsSubmitted}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Won</p>
                    <p className="font-semibold text-green-300">{cohortData.totals.dealsWon}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-[#E4DDD3] bg-white/90 shadow-sm backdrop-blur-sm md:block">
            <div className="overflow-x-auto scroll-touch">
              <table className="w-full min-w-[980px]">
                <thead className="bg-[#FBF3E7]">
                  <tr>
                    <th className="text-left py-4 px-4 text-sm font-bold text-[#1C1B1A]">Cohort</th>
                    <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">Start Date</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Total</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Booked</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Lead→Call %</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Apps</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Call→App %</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">App→Won %</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-green-700">Deals Won</th>
                    <th className="text-right py-4 px-4 text-sm font-semibold text-green-700">Lead→Deal %</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortData?.cohorts.map((cohort, index) => (
                    <tr
                      key={cohort.cohort}
                      className={`border-b border-[#E4DDD3]/50 hover:bg-[#FBF3E7]/30 ${
                        index % 2 === 0 ? "bg-white" : "bg-[#FBF3E7]/10"
                      }`}
                    >
                      <td className="py-3 px-4 text-sm font-bold text-[#625FFF]">{cohort.cohort}</td>
                      <td className="py-3 px-4 text-sm text-[#55514D]">
                        {cohort.startDate
                          ? new Date(cohort.startDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "N/A"}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-[#1C1B1A]">
                        {cohort.totalLeads}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-[#55514D]">{cohort.booked}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-[#625FFF]">
                        {formatPercent(cohort.leadToCallRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-[#55514D]">{cohort.appsSubmitted}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-[#625FFF]">
                        {formatPercent(cohort.callToAppRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-[#625FFF]">
                        {formatPercent(cohort.appToDealsWonRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-green-600">
                        {cohort.dealsWon}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-bold text-green-700">
                        {formatPercent(cohort.leadToDealsWonRate)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  {cohortData?.totals && (
                    <tr className="bg-[#1C1B1A] text-white font-bold">
                      <td className="py-3 px-4 text-sm">TOTALS</td>
                      <td className="py-3 px-4 text-sm">—</td>
                      <td className="py-3 px-4 text-sm text-right">{cohortData.totals.totalLeads}</td>
                      <td className="py-3 px-4 text-sm text-right">{cohortData.totals.booked}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {formatPercent(cohortData.totals.leadToCallRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">{cohortData.totals.appsSubmitted}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {formatPercent(cohortData.totals.callToAppRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">
                        {formatPercent(cohortData.totals.appToDealsWonRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-green-400">
                        {cohortData.totals.dealsWon}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-green-400">
                        {formatPercent(cohortData.totals.leadToDealsWonRate)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 4: Loan Type Performance */}
        {loanTypeData && loanTypeData.loanTypes.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-[#1C1B1A] sm:text-2xl">Performance by Loan Type</h2>
            <div className="space-y-3 md:hidden">
              {loanTypeData.loanTypes.map((lt) => (
                <div
                  key={lt.loanType}
                  className="rounded-xl border border-[#E4DDD3] bg-white/90 p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="text-base font-semibold text-[#625FFF]">{lt.displayName}</p>
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                      {formatPercent(lt.leadToDealsWonRate)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[#8E8983]">Total Leads</p>
                      <p className="font-semibold text-[#1C1B1A]">{lt.totalLeads}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">Booked</p>
                      <p className="font-semibold text-[#1C1B1A]">
                        {lt.booked} ({formatPercent(lt.leadToCallRate)})
                      </p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">Apps</p>
                      <p className="font-semibold text-[#1C1B1A]">{lt.appsSubmitted}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">Deals Won</p>
                      <p className="font-semibold text-green-700">
                        {lt.dealsWon} ({formatPercent(lt.appToDealsWonRate)})
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-xl bg-[#1C1B1A] p-4 text-white shadow-sm">
                <p className="text-sm font-semibold">All Types</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-white/60">Leads</p>
                    <p className="font-semibold">{loanTypeData.totals.totalLeads}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Booked</p>
                    <p className="font-semibold">{loanTypeData.totals.booked}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Apps</p>
                    <p className="font-semibold">{loanTypeData.totals.appsSubmitted}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Won</p>
                    <p className="font-semibold text-green-300">{loanTypeData.totals.dealsWon}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-[#E4DDD3] bg-white/90 shadow-sm backdrop-blur-sm md:block">
              <div className="overflow-x-auto scroll-touch">
                <table className="w-full min-w-[860px]">
                  <thead className="bg-[#FBF3E7]">
                    <tr>
                      <th className="text-left py-4 px-4 text-sm font-bold text-[#1C1B1A]">Loan Type</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Total</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Booked</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Lead→Call %</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Apps</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">App→Won %</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-green-700">Deals Won</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-green-700">Lead→Deal %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loanTypeData.loanTypes.map((lt, index) => (
                      <tr
                        key={lt.loanType}
                        className={`border-b border-[#E4DDD3]/50 hover:bg-[#FBF3E7]/30 ${
                          index % 2 === 0 ? "bg-white" : "bg-[#FBF3E7]/10"
                        }`}
                      >
                        <td className="py-3 px-4 text-sm font-bold text-[#625FFF]">{lt.displayName}</td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-[#1C1B1A]">
                          {lt.totalLeads}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-[#55514D]">{lt.booked}</td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-[#625FFF]">
                          {formatPercent(lt.leadToCallRate)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-[#55514D]">{lt.appsSubmitted}</td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-[#625FFF]">
                          {formatPercent(lt.appToDealsWonRate)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-green-600">
                          {lt.dealsWon}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-green-700">
                          {formatPercent(lt.leadToDealsWonRate)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-[#1C1B1A] text-white font-bold">
                      <td className="py-3 px-4 text-sm">ALL TYPES</td>
                      <td className="py-3 px-4 text-sm text-right">{loanTypeData.totals.totalLeads}</td>
                      <td className="py-3 px-4 text-sm text-right">{loanTypeData.totals.booked}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {formatPercent(loanTypeData.totals.leadToCallRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right">{loanTypeData.totals.appsSubmitted}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {formatPercent(loanTypeData.totals.appToDealsWonRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-green-400">
                        {loanTypeData.totals.dealsWon}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-green-400">
                        {formatPercent(loanTypeData.totals.leadToDealsWonRate)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Appointments by Booking Source */}
        {bookingSourceData && bookingSourceData.sources.some(s => s.total > 0) && (
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-[#1C1B1A] sm:text-2xl">Appointments by Booking Source</h2>

            {/* Summary Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {bookingSourceData.sources.map((source) => (
                <div
                  key={source.source}
                  className={`bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border p-5 ${
                    source.source === "MANUAL"
                      ? "border-[#8B88FF]/30 bg-[#8B88FF]/5"
                      : source.source === "LOD"
                      ? "border-[#625FFF]/30 bg-[#625FFF]/5"
                      : "border-[#E4DDD3]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-semibold ${
                      source.source === "MANUAL"
                        ? "text-[#625FFF]"
                        : source.source === "LOD"
                        ? "text-[#625FFF]"
                        : "text-[#55514D]"
                    }`}>
                      {source.displayName}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      source.source === "MANUAL"
                        ? "bg-[#8B88FF]/20 text-[#625FFF]"
                        : source.source === "LOD"
                        ? "bg-[#625FFF]/20 text-[#625FFF]"
                        : "bg-[#FBF3E7] text-[#55514D]"
                    }`}>
                      {source.total} total
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-[#1C1B1A] mb-2">
                    {formatPercent(source.showUpRate)}
                  </div>
                  <div className="text-xs text-[#55514D]">
                    Show-up rate ({source.completed} of {source.completed + source.noShow})
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed Table */}
            <div className="space-y-3 md:hidden">
              {bookingSourceData.sources.map((source) => (
                <div
                  key={source.source}
                  className="rounded-xl border border-[#E4DDD3] bg-white/90 p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="text-base font-semibold text-[#1C1B1A]">{source.displayName}</p>
                    <span className="rounded-full bg-[#625FFF]/10 px-2.5 py-1 text-xs font-semibold text-[#625FFF]">
                      {formatPercent(source.showUpRate)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[#8E8983]">Total</p>
                      <p className="font-semibold text-[#1C1B1A]">{source.total}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">Scheduled</p>
                      <p className="font-semibold text-[#1C1B1A]">{source.scheduled}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">Completed</p>
                      <p className="font-semibold text-[#1C1B1A]">{source.completed}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">No Show</p>
                      <p className="font-semibold text-[#1C1B1A]">{source.noShow}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">Show-up Rate</p>
                      <p className="font-semibold text-[#625FFF]">{formatPercent(source.showUpRate)}</p>
                    </div>
                    <div>
                      <p className="text-[#8E8983]">Conversion</p>
                      <p className="font-semibold text-green-700">{formatPercent(source.conversionRate)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-[#E4DDD3] bg-white/90 shadow-sm backdrop-blur-sm md:block">
              <div className="overflow-x-auto scroll-touch">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-[#FBF3E7]">
                    <tr>
                      <th className="text-left py-4 px-4 text-sm font-bold text-[#1C1B1A]">Source</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Total</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Scheduled</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">Completed</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#55514D]">No Show</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#625FFF]">Show-up %</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-green-700">Conv. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingSourceData.sources.map((source, index) => (
                      <tr
                        key={source.source}
                        className={`border-b border-[#E4DDD3]/50 hover:bg-[#FBF3E7]/30 ${
                          index % 2 === 0 ? "bg-white" : "bg-[#FBF3E7]/10"
                        }`}
                      >
                        <td className={`py-3 px-4 text-sm font-bold ${
                          source.source === "MANUAL" ? "text-[#625FFF]" : "text-[#1C1B1A]"
                        }`}>
                          {source.displayName}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-[#1C1B1A]">
                          {source.total}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-[#55514D]">
                          {source.scheduled}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-[#55514D]">
                          {source.completed}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-[#55514D]">
                          {source.noShow}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-semibold text-[#625FFF]">
                          {formatPercent(source.showUpRate)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-green-700">
                          {formatPercent(source.conversionRate)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-[#1C1B1A] text-white font-bold">
                      <td className="py-3 px-4 text-sm">TOTALS</td>
                      <td className="py-3 px-4 text-sm text-right">{bookingSourceData.totals.total}</td>
                      <td className="py-3 px-4 text-sm text-right">{bookingSourceData.totals.scheduled}</td>
                      <td className="py-3 px-4 text-sm text-right">{bookingSourceData.totals.completed}</td>
                      <td className="py-3 px-4 text-sm text-right">{bookingSourceData.totals.noShow}</td>
                      <td className="py-3 px-4 text-sm text-right">
                        {formatPercent(bookingSourceData.totals.showUpRate)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-green-400">
                        {formatPercent(bookingSourceData.totals.conversionRate)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section 6: Status Breakdown (simplified) */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#1C1B1A] mb-4">Lead Status Breakdown</h2>
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {overview?.statusBreakdown
                ?.filter((s) => !["NURTURING"].includes(s.status)) // Hide less important statuses
                .sort((a, b) => {
                  // Sort by funnel order
                  const order = ["NEW", "CONTACTED", "ENGAGED", "CALL_SCHEDULED", "WAITING_FOR_APPLICATION", "APPLICATION_STARTED", "CONVERTED", "DEALS_WON", "LOST"];
                  return order.indexOf(a.status) - order.indexOf(b.status);
                })
                .map((status) => (
                  <div key={status.status} className="text-center p-3 bg-[#FBF3E7]/50 rounded-lg">
                    <div className="text-2xl font-bold text-[#1C1B1A]">{status.count}</div>
                    <div className="text-xs text-[#55514D] capitalize">
                      {status.status.replace(/_/g, " ").toLowerCase()}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
