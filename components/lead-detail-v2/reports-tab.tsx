"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { LeadWithRelations } from "@/types/lead";
import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";

type Advisor = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  calLink: string | null;
};

type SavedReport = {
  id: string;
  consultantName: string;
  bullets: string[];
  mortgageAmount: number;
  sentToEmail: string | null;
  sentAt: string | null;
  createdAt: string;
  generatedBy: Advisor;
};

type ReportsTabProps = {
  lead: LeadWithRelations;
};

export function ReportsTab({ lead }: ReportsTabProps) {
  const { data: session, status } = useSession();
  const [selectedAdvisor, setSelectedAdvisor] = useState<Advisor | null>(null);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [notes, setNotes] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isLoadingAdvisors, setIsLoadingAdvisors] = useState(false);

  // Report persistence state
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";
  const isAdvisor = session?.user?.role === "ADVISOR";

  // Fetch advisors for ADMIN users, or fetch current user's full details for ADVISOR
  useEffect(() => {
    async function loadAdvisors() {
      if (status !== "authenticated" || !session?.user) return;

      setIsLoadingAdvisors(true);
      try {
        if (isAdmin) {
          // ADMIN: fetch all advisors
          const response = await fetch("/api/users/advisors");
          if (response.ok) {
            const data = await response.json();
            setAdvisors(data);
          }
        } else if (isAdvisor) {
          // ADVISOR: fetch current user's full details (including phone, calLink)
          const response = await fetch("/api/users/me");
          if (response.ok) {
            const userData = await response.json();
            setSelectedAdvisor({
              id: userData.id,
              name: userData.name,
              email: userData.email,
              phone: userData.phone,
              calLink: userData.calLink,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch advisor data:", err);
      } finally {
        setIsLoadingAdvisors(false);
      }
    }

    loadAdvisors();
  }, [session, status, isAdmin, isAdvisor]);

  // Fetch existing reports for this lead
  useEffect(() => {
    async function loadReports() {
      if (!lead.id) return;

      setIsLoadingReports(true);
      try {
        const response = await fetch(`/api/reports?leadId=${lead.id}`);
        if (response.ok) {
          const data = await response.json();
          setSavedReports(data);
        }
      } catch (err) {
        console.error("Failed to fetch reports:", err);
      } finally {
        setIsLoadingReports(false);
      }
    }

    loadReports();
  }, [lead.id]);

  const canGenerate = selectedAdvisor !== null && notes.trim().length >= 50;

  // Get mortgage balance from rawData
  const rawData = lead.rawData as Record<string, unknown> | null;
  const mortgageBalance = rawData?.balance
    ? parseFloat(String(rawData.balance).replace(/[^0-9.]/g, ""))
    : 0;

  // Calculate savings
  const annualSavings = mortgageBalance * 0.0125;
  const fiveYearSavings = annualSavings * 5;
  const cashBack = mortgageBalance * 0.03;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    setError(null);
    setShowPreview(true);

    try {
      const response = await fetch("/api/ai/generate-bullets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate bullets");
      }

      const data = await response.json();
      setBullets(data.bullets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setBullets([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    handleGeneratePreview();
  };

  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...bullets];
    newBullets[index] = value;
    setBullets(newBullets);
  };

  const handleDeleteBullet = (index: number) => {
    setBullets(bullets.filter((_, i) => i !== index));
  };

  const handleAddBullet = () => {
    setBullets([...bullets, ""]);
  };

  const handleDownloadPDF = async () => {
    if (bullets.length === 0) {
      alert("Please generate bullet points first");
      return;
    }

    if (!selectedAdvisor) {
      alert("Please select an advisor");
      return;
    }

    setIsGeneratingPDF(true);

    try {
      // Dynamic import to avoid SSR issues
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportPDFDocument } = await import("./report-pdf-template");

      const clientName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Client";
      const date = new Date().toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Generate the PDF blob with full advisor details
      const blob = await pdf(
        ReportPDFDocument({
          clientName,
          date,
          consultant: {
            name: selectedAdvisor.name,
            email: selectedAdvisor.email,
            phone: selectedAdvisor.phone || undefined,
            calLink: selectedAdvisor.calLink || undefined,
          },
          bullets,
          mortgageAmount: formatCurrency(mortgageBalance),
          annualSavings: formatCurrency(annualSavings),
          fiveYearSavings: formatCurrency(fiveYearSavings),
          cashBack: formatCurrency(cashBack),
        })
      ).toBlob();

      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${clientName.replace(/\s+/g, "-")}-Mortgage-Strategy-Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Save the report to the database
      const saveResponse = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          advisorId: selectedAdvisor.id,
          consultantName: selectedAdvisor.name,
          bullets,
          mortgageAmount: mortgageBalance,
        }),
      });

      if (saveResponse.ok) {
        const savedReport = await saveResponse.json();
        setCurrentReportId(savedReport.id);
        // Add to the list of saved reports
        setSavedReports((prev) => [savedReport, ...prev]);
      }
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Download a historical report
  const handleDownloadHistoricalReport = async (report: SavedReport) => {
    setDownloadingReportId(report.id);

    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { ReportPDFDocument } = await import("./report-pdf-template");

      const clientName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Client";
      const date = new Date(report.createdAt).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Use the saved data from the report
      const savedMortgageAmount = report.mortgageAmount;
      const savedAnnualSavings = savedMortgageAmount * 0.0125;
      const savedFiveYearSavings = savedAnnualSavings * 5;
      const savedCashBack = savedMortgageAmount * 0.03;

      const blob = await pdf(
        ReportPDFDocument({
          clientName,
          date,
          consultant: {
            name: report.consultantName,
            email: report.generatedBy.email,
            phone: report.generatedBy.phone || undefined,
            calLink: report.generatedBy.calLink || undefined,
          },
          bullets: report.bullets,
          mortgageAmount: formatCurrency(savedMortgageAmount),
          annualSavings: formatCurrency(savedAnnualSavings),
          fiveYearSavings: formatCurrency(savedFiveYearSavings),
          cashBack: formatCurrency(savedCashBack),
        })
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${clientName.replace(/\s+/g, "-")}-Mortgage-Strategy-Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloadingReportId(null);
    }
  };

  // Send report to client
  const handleSendReport = async (reportId: string) => {
    // Check if lead has email
    if (!lead.email) {
      alert("Cannot send report: Lead does not have an email address");
      return;
    }

    // Check email consent
    if (lead.consentEmail === false) {
      alert("Cannot send report: Lead has not consented to receive emails");
      return;
    }

    setSendingReportId(reportId);

    try {
      const response = await fetch(`/api/reports/${reportId}/send`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send report");
      }

      const data = await response.json();

      // Update the report in the list with sent info
      setSavedReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, sentAt: data.report.sentAt, sentToEmail: data.report.sentToEmail }
            : r
        )
      );

      alert("Report sent successfully!");
    } catch (err) {
      console.error("Error sending report:", err);
      alert(err instanceof Error ? err.message : "Failed to send report");
    } finally {
      setSendingReportId(null);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Report Generator Card */}
      <Card>
        <CardContent className="pt-5">
          <SectionLabel>Generate Post-Discovery Report</SectionLabel>

          <div className="space-y-4 mt-4">
            {/* Consultant Selection */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-2">
                Consultant
              </label>

              {status === "loading" || isLoadingAdvisors ? (
                <div className="w-full border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#8E8983] bg-gray-50">
                  Loading...
                </div>
              ) : isAdvisor && selectedAdvisor ? (
                // ADVISOR: Show their name (read-only)
                <div className="w-full border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#1C1B1A] bg-gray-50">
                  {selectedAdvisor.name}
                </div>
              ) : isAdmin ? (
                // ADMIN: Show dropdown to select advisor
                <select
                  value={selectedAdvisor?.id || ""}
                  onChange={(e) => {
                    const advisor = advisors.find((a) => a.id === e.target.value);
                    setSelectedAdvisor(advisor || null);
                  }}
                  className="w-full border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] transition-all duration-150"
                >
                  <option value="">Select advisor...</option>
                  {advisors.map((advisor) => (
                    <option key={advisor.id} value={advisor.id}>
                      {advisor.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#8E8983] bg-gray-50">
                  Please sign in
                </div>
              )}
            </div>

            {/* Granola Notes Textarea */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-2">
                Discovery Call Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your discovery call notes from Granola here..."
                className="w-full min-h-[200px] border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#1C1B1A] resize-none focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] transition-all duration-150"
              />
              {notes.length > 0 && notes.length < 50 && (
                <p className="text-xs text-[#8E8983] mt-1">
                  Please provide at least 50 characters ({50 - notes.length} more needed)
                </p>
              )}
            </div>

            {/* Generate Button */}
            <Button
              variant="primary"
              onClick={handleGeneratePreview}
              disabled={!canGenerate || isGenerating}
              className="w-full"
            >
              {isGenerating ? "Generating..." : "Generate Preview"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {showPreview && (
        <Card className="bg-[#FBF3E7]">
          <CardContent className="pt-5">
            <SectionLabel>Report Preview</SectionLabel>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            {/* What You Told Us Section */}
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-[#1C1B1A] mb-3">
                What You Told Us
              </h4>

              {isGenerating ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-4 h-4 border-2 border-[#625FFF] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-[#8E8983]">Generating summary...</span>
                </div>
              ) : bullets.length > 0 ? (
                <div className="space-y-3">
                  {bullets.map((bullet, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-[#625FFF] mt-2.5 flex-shrink-0">•</span>
                      <div className="flex-1 min-w-0">
                        <textarea
                          value={bullet}
                          onChange={(e) => {
                            handleBulletChange(index, e.target.value);
                            // Auto-resize
                            e.target.style.height = "auto";
                            e.target.style.height = e.target.scrollHeight + "px";
                          }}
                          onFocus={(e) => {
                            // Ensure correct height on focus
                            e.target.style.height = "auto";
                            e.target.style.height = e.target.scrollHeight + "px";
                          }}
                          ref={(el) => {
                            // Set initial height
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = el.scrollHeight + "px";
                            }
                          }}
                          rows={1}
                          className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] resize-none overflow-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteBullet(index)}
                        className="p-2 text-[#8E8983] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150 flex-shrink-0 self-start"
                        aria-label="Delete bullet"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddBullet}
                    className="text-sm text-[#625FFF] hover:text-[#514EE0] font-medium mt-2"
                  >
                    + Add bullet
                  </button>
                </div>
              ) : !error ? (
                <p className="text-sm text-[#8E8983] py-2">
                  Click &quot;Generate Preview&quot; to create bullet points from your notes.
                </p>
              ) : null}
            </div>

            {/* Calculated Values Section */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-[#1C1B1A] mb-3">
                Calculated Values
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#8E8983]">Mortgage Amount</p>
                  <p className="text-sm font-semibold text-[#1C1B1A]">
                    {formatCurrency(mortgageBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8E8983]">Annual Savings</p>
                  <p className="text-sm font-semibold text-[#1C1B1A]">
                    {formatCurrency(annualSavings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8E8983]">5-Year Savings</p>
                  <p className="text-sm font-semibold text-[#1C1B1A]">
                    {formatCurrency(fiveYearSavings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8E8983]">Cash Back</p>
                  <p className="text-sm font-semibold text-[#1C1B1A]">
                    {formatCurrency(cashBack)}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                onClick={handleRegenerate}
                disabled={isGenerating}
              >
                Regenerate
              </Button>
              <Button
                variant="primary"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF || bullets.length === 0}
              >
                {isGeneratingPDF ? "Generating PDF..." : "Download PDF"}
              </Button>
              <Button
                variant="primary"
                onClick={() => currentReportId && handleSendReport(currentReportId)}
                disabled={
                  !currentReportId ||
                  sendingReportId === currentReportId ||
                  !lead.email ||
                  lead.consentEmail === false
                }
                title={
                  !lead.email
                    ? "Lead has no email"
                    : lead.consentEmail === false
                    ? "Lead has not consented to emails"
                    : !currentReportId
                    ? "Save the report first by downloading"
                    : undefined
                }
              >
                {sendingReportId === currentReportId ? "Sending..." : "Send to Client"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report History Card */}
      <Card>
        <CardContent className="pt-5">
          <SectionLabel>Previous Reports</SectionLabel>

          <div className="mt-4">
            {isLoadingReports ? (
              <div className="text-center py-6">
                <div className="w-6 h-6 border-2 border-[#625FFF] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-[#8E8983]">Loading reports...</p>
              </div>
            ) : savedReports.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-[#FBF3E7] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-[#8E8983]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-[#8E8983]">No reports generated yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 bg-[#FBF3E7] rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-[#625FFF] flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="text-sm font-medium text-[#1C1B1A] truncate">
                          {formatDate(report.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-[#8E8983]">
                          by {report.consultantName}
                        </span>
                        <span className="text-xs text-[#8E8983]">•</span>
                        <span className="text-xs text-[#8E8983]">
                          {formatCurrency(report.mortgageAmount)}
                        </span>
                        {report.sentAt ? (
                          <>
                            <span className="text-xs text-[#8E8983]">•</span>
                            <span className="text-xs text-green-600">
                              Sent to {report.sentToEmail}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-[#8E8983]">•</span>
                            <span className="text-xs text-[#8E8983]">
                              Not sent
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        type="button"
                        onClick={() => handleDownloadHistoricalReport(report)}
                        disabled={downloadingReportId === report.id}
                        className="p-2 text-[#625FFF] hover:bg-white rounded-lg transition-all duration-150 disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloadingReportId === report.id ? (
                          <div className="w-4 h-4 border-2 border-[#625FFF] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        )}
                      </button>
                      {!report.sentAt && (
                        <button
                          type="button"
                          onClick={() => handleSendReport(report.id)}
                          disabled={
                            sendingReportId === report.id ||
                            !lead.email ||
                            lead.consentEmail === false
                          }
                          className="p-2 text-[#625FFF] hover:bg-white rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            !lead.email
                              ? "Lead has no email"
                              : lead.consentEmail === false
                              ? "Lead has not consented to emails"
                              : "Send to client"
                          }
                        >
                          {sendingReportId === report.id ? (
                            <div className="w-4 h-4 border-2 border-[#625FFF] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
