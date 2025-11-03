"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogoutButton } from "../logout-button";

interface CohortInfo {
  currentCohort: string;
  cohortNumber: number;
  cohortStartDate: string;
  totalLeads: number;
  cohortStats: Array<{ cohort: string; count: number }>;
}

export default function AdminPage() {
  const [cohortInfo, setCohortInfo] = useState<CohortInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    fetchCohortInfo();
  }, []);

  const fetchCohortInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cohorts");
      const data = await res.json();
      if (data.success) {
        setCohortInfo(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch cohort info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceCohort = async () => {
    setAdvancing(true);
    try {
      const res = await fetch("/api/admin/cohorts", {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        alert(data.message);
        setShowAdvanceModal(false);
        await fetchCohortInfo(); // Refresh data
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to advance cohort:", error);
      alert("Failed to advance cohort. Check console for details.");
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30 flex items-center justify-center">
        <div className="text-2xl text-[#1C1B1A]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF3E7] via-[#B1AFFF]/20 to-[#F6D7FF]/30">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-[#E4DDD3]">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-[#1C1B1A]">
                <span className="italic text-[#625FFF]">inspired</span>{" "}
                <span className="font-bold">mortgage.</span>
              </h1>
              <p className="text-[#55514D] mt-2 text-lg">Cohort Management</p>
            </div>
            <div className="flex items-center gap-3">
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

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Current Cohort Display */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1C1B1A] mb-2">
                Current Active Cohort
              </h2>
              <p className="text-sm text-[#55514D] mb-6">
                All new leads from now onwards will be assigned to this cohort
              </p>

              <div className="inline-flex items-center px-6 py-4 bg-[#625FFF] rounded-lg mb-4">
                <span className="text-5xl font-extrabold text-white">
                  {cohortInfo?.currentCohort || "N/A"}
                </span>
              </div>

              <div className="space-y-2 text-sm text-[#55514D]">
                <div>
                  <span className="font-semibold">Cohort Number:</span>{" "}
                  {cohortInfo?.cohortNumber || "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Start Date:</span>{" "}
                  {cohortInfo?.cohortStartDate
                    ? new Date(cohortInfo.cohortStartDate).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )
                    : "N/A"}
                </div>
                <div>
                  <span className="font-semibold">Total Leads (All Time):</span>{" "}
                  {cohortInfo?.totalLeads || 0}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAdvanceModal(true)}
              className="px-6 py-3 bg-[#625FFF] text-white font-semibold rounded-lg hover:bg-[#524DD9] transition-colors shadow-md hover:shadow-lg"
            >
              Start Next Cohort
            </button>
          </div>
        </div>

        {/* Cohort Statistics Table */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-8">
          <h2 className="text-2xl font-bold text-[#1C1B1A] mb-4">
            Lead Count by Cohort
          </h2>
          <p className="text-sm text-[#55514D] mb-6">
            Historical view of all leads assigned to each cohort
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#E4DDD3]">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Cohort
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Lead Count
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Percentage
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-[#55514D]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {cohortInfo?.cohortStats
                  .sort((a, b) => a.cohort.localeCompare(b.cohort))
                  .map((stat) => (
                    <tr
                      key={stat.cohort}
                      className="border-b border-[#E4DDD3]/50 hover:bg-[#FBF3E7]/30"
                    >
                      <td className="py-3 px-4 text-sm font-bold text-[#1C1B1A]">
                        {stat.cohort}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#55514D]">
                        {stat.count.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#625FFF] font-semibold">
                        {cohortInfo.totalLeads > 0
                          ? ((stat.count / cohortInfo.totalLeads) * 100).toFixed(
                              1
                            )
                          : 0}
                        %
                      </td>
                      <td className="py-3 px-4">
                        {stat.cohort === cohortInfo.currentCohort ? (
                          <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                            Historical
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Advance Cohort Confirmation Modal */}
        {showAdvanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-[#1C1B1A] mb-4">
                Confirm Cohort Advancement
              </h3>
              <p className="text-sm text-[#55514D] mb-4">
                You are about to advance from <strong>{cohortInfo?.currentCohort}</strong> to{" "}
                <strong>COHORT_{(cohortInfo?.cohortNumber || 0) + 1}</strong>.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> Once you advance, all NEW leads will be assigned to the
                  next cohort. Existing leads will remain in their original cohorts.
                </p>
              </div>

              <p className="text-sm text-[#55514D] mb-6">
                This action cannot be undone. Are you sure you want to proceed?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAdvanceModal(false)}
                  disabled={advancing}
                  className="flex-1 px-4 py-2 text-sm font-medium text-[#55514D] border border-[#E4DDD3] rounded-md hover:bg-[#FBF3E7] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdvanceCohort}
                  disabled={advancing}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#625FFF] rounded-md hover:bg-[#524DD9] transition-colors disabled:opacity-50"
                >
                  {advancing ? "Advancing..." : "Yes, Advance Cohort"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
