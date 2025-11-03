"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "../logout-button";

interface CohortMetrics {
  cohort: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  bookedLeads: number;
  bookingRate: number;
  completedCalls: number;
  callCompletionRate: number;
  avgDaysToConversion: number | null;
  directBookingCount: number;
  directBookingRate: number;
  startDate: string | null;
}

interface CohortComparisonData {
  cohorts: CohortMetrics[];
  totalCohorts: number;
}

export default function CohortComparisonPage() {
  const [data, setData] = useState<CohortComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCohortComparison();
  }, []);

  const fetchCohortComparison = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics/cohort-comparison");
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch cohort comparison:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    const headers = [
      "Cohort",
      "Start Date",
      "Total Leads",
      "Booked Leads",
      "Booking Rate (%)",
      "Completed Calls",
      "Call Completion Rate (%)",
      "Converted Leads",
      "Conversion Rate (%)",
      "Avg Days to Conversion",
      "Direct Bookings",
      "Direct Booking Rate (%)",
    ];

    const rows = data.cohorts.map((c) => [
      c.cohort,
      c.startDate ? new Date(c.startDate).toLocaleDateString() : "N/A",
      c.totalLeads,
      c.bookedLeads,
      c.bookingRate.toFixed(1),
      c.completedCalls,
      c.callCompletionRate.toFixed(1),
      c.convertedLeads,
      c.conversionRate.toFixed(1),
      c.avgDaysToConversion ? c.avgDaysToConversion.toFixed(1) : "N/A",
      c.directBookingCount,
      c.directBookingRate.toFixed(1),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cohort-comparison-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30 flex items-center justify-center">
        <div className="text-2xl text-[#1C1B1A]">Loading cohort comparison...</div>
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
              <p className="text-[#55514D] mt-2 text-lg">Cohort Comparison Dashboard</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin"
                className="px-4 py-2 text-sm text-[#625FFF] border border-[#625FFF] rounded-md hover:bg-[#625FFF] hover:text-white transition-colors"
              >
                Manage Cohorts
              </Link>
              <Link
                href="/dashboard/analytics"
                className="px-4 py-2 text-sm text-[#625FFF] border border-[#625FFF] rounded-md hover:bg-[#625FFF] hover:text-white transition-colors"
              >
                Analytics
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm text-[#625FFF] border border-[#625FFF] rounded-md hover:bg-[#625FFF] hover:text-white transition-colors"
              >
                Pipeline
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1C1B1A] mb-2">
              Side-by-Side Cohort Performance
            </h2>
            <p className="text-sm text-[#55514D]">
              Compare conversion metrics across all cohorts
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-[#625FFF] text-white font-medium rounded-lg hover:bg-[#524DD9] transition-colors"
          >
            Export to CSV
          </button>
        </div>

        {/* Comparison Table */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#FBF3E7]">
                <tr>
                  <th className="sticky left-0 bg-[#FBF3E7] text-left py-4 px-4 text-sm font-bold text-[#1C1B1A] border-r border-[#E4DDD3]">
                    Cohort
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Start Date
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Total Leads
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Booked
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Booking Rate
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Calls Done
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Call Rate
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Converted
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Conv. Rate
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Avg Days
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-[#55514D]">
                    Direct Book
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.cohorts.map((cohort, index) => (
                  <tr
                    key={cohort.cohort}
                    className={`border-b border-[#E4DDD3]/50 hover:bg-[#FBF3E7]/30 ${
                      index % 2 === 0 ? "bg-white" : "bg-[#FBF3E7]/10"
                    }`}
                  >
                    <td className="sticky left-0 bg-inherit py-3 px-4 text-sm font-bold text-[#625FFF] border-r border-[#E4DDD3]">
                      {cohort.cohort}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D]">
                      {cohort.startDate
                        ? new Date(cohort.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-[#1C1B1A]">
                      {cohort.totalLeads}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D]">
                      {cohort.bookedLeads}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-[#625FFF]">
                      {cohort.bookingRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D]">
                      {cohort.completedCalls}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-[#625FFF]">
                      {cohort.callCompletionRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-sm text-[#2E7D32] font-semibold">
                      {cohort.convertedLeads}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-[#2E7D32]">
                      {cohort.conversionRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D]">
                      {cohort.avgDaysToConversion
                        ? `${cohort.avgDaysToConversion.toFixed(1)} days`
                        : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#55514D]">
                      {cohort.directBookingCount} ({cohort.directBookingRate.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <h3 className="text-sm font-semibold text-[#55514D] mb-2">Total Cohorts</h3>
            <div className="text-4xl font-bold text-[#625FFF]">
              {data?.totalCohorts || 0}
            </div>
            <div className="text-xs text-[#55514D] mt-2">Active and historical</div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <h3 className="text-sm font-semibold text-[#55514D] mb-2">
              Best Performing Cohort
            </h3>
            {data && data.cohorts.length > 0 && (
              <>
                <div className="text-4xl font-bold text-[#2E7D32]">
                  {[...data.cohorts].sort((a, b) => b.conversionRate - a.conversionRate)[0]
                    .cohort}
                </div>
                <div className="text-xs text-[#55514D] mt-2">
                  {[...data.cohorts].sort(
                    (a, b) => b.conversionRate - a.conversionRate
                  )[0].conversionRate.toFixed(1)}
                  % conversion rate
                </div>
              </>
            )}
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
            <h3 className="text-sm font-semibold text-[#55514D] mb-2">
              Total Leads (All Cohorts)
            </h3>
            <div className="text-4xl font-bold text-[#1C1B1A]">
              {data?.cohorts.reduce((sum, c) => sum + c.totalLeads, 0) || 0}
            </div>
            <div className="text-xs text-[#55514D] mt-2">
              {data?.cohorts.reduce((sum, c) => sum + c.convertedLeads, 0) || 0} converted
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
