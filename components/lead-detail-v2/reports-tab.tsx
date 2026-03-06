"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { LeadWithRelations } from "@/types/lead";
import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { formatCurrency, calculateScenario1Data, calculateScenario2Data } from "@/lib/mortgage-calculations";

// ExtractedData type for mortgage calculations
type ExtractedData = {
  mortgageAmount?: number;
  originalAmortization?: number;
  currentAmortization?: number;
  previousRate?: number;
  currentMarketRate?: number;
  oldPayment?: number;
  newPayment?: number;
  paymentDifference?: number;
  fiveYearsOfPayments?: number;
  originalRate?: number;
  lockInRate?: number;
  estimatedExtraInterest?: number;
  fixedPayment?: number;
  otherDebts?: Array<{ type: string; balance: number; payment: number }>;
};

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
  scenario: number;
  includeDebtConsolidation: boolean;
  includeCashBack: boolean;
  applicationLink: string;
  partnerName: string | null;
  extractedData: ExtractedData | null;
  sentToEmail: string | null;
  sentAt: string | null;
  createdAt: string;
  generatedBy: Advisor;
};

type ReportsTabProps = {
  lead: LeadWithRelations;
};

const SCENARIO_OPTIONS = [
  { value: 0, label: "None (skip scenario section)", description: "No scenario section will be included in the report" },
  { value: 1, label: "Scenario 1: Sub-2% Fixed → Renewal Trap", description: "Client locked in at sub-2% in 2020-2021, now facing payment shock" },
  { value: 2, label: "Scenario 2: Variable → Panic Lock", description: "Client was in variable, rode rates up, then panic-locked at peak" },
  { value: 3, label: "Scenario 3: Fixed Payment Variable → Negative Am", description: "Client had variable with fixed payments, didn't realize balance was growing" },
];

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

  // New state for scenario and debt consolidation
  const [scenario, setScenario] = useState<0 | 1 | 2 | 3 | null>(null);
  const [includeDebtConsolidation, setIncludeDebtConsolidation] = useState(false);
  const [includeCashBack, setIncludeCashBack] = useState(false);
  const [applicationUrl, setApplicationUrl] = useState("https://stressfree.mtg-app.com/signup");
  const [partnerName, setPartnerName] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isExtractingData, setIsExtractingData] = useState(false);

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

  const canGenerate = selectedAdvisor !== null && notes.trim().length >= 50 && scenario !== null;

  // Get mortgage balance from rawData
  const rawData = lead.rawData as Record<string, unknown> | null;
  const mortgageBalance = rawData?.balance
    ? parseFloat(String(rawData.balance).replace(/[^0-9.]/g, ""))
    : 0;

  const handleGeneratePreview = async () => {
    if (scenario === null) {
      setError("Please select a scenario (or 'None' to skip)");
      return;
    }

    setIsGenerating(true);
    setIsExtractingData(scenario !== 0);
    setError(null);
    setShowPreview(true);

    try {
      if (scenario === 0) {
        // "None" scenario — only generate bullets, skip data extraction
        const bulletsResponse = await fetch("/api/ai/generate-bullets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });

        if (!bulletsResponse.ok) {
          const data = await bulletsResponse.json();
          throw new Error(data.error || "Failed to generate bullets");
        }

        const bulletsData = await bulletsResponse.json();
        setBullets(bulletsData.bullets);
        setExtractedData(null);
      } else {
        // Generate bullets and extract data in parallel
        const [bulletsResponse, extractResponse] = await Promise.all([
          fetch("/api/ai/generate-bullets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes }),
          }),
          fetch("/api/ai/extract-mortgage-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              notes,
              scenario,
              leadRawData: lead.rawData,
            }),
          }),
        ]);

        if (!bulletsResponse.ok) {
          const data = await bulletsResponse.json();
          throw new Error(data.error || "Failed to generate bullets");
        }

        const bulletsData = await bulletsResponse.json();
        setBullets(bulletsData.bullets);

        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          setExtractedData(extractData.extractedData);
        } else {
          // Don't fail entirely if extraction fails, just show warning
          console.error("Failed to extract mortgage data");
          setExtractedData(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setBullets([]);
    } finally {
      setIsGenerating(false);
      setIsExtractingData(false);
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

  // Handle editing extracted data with automatic recalculation
  const handleExtractedDataChange = (field: keyof ExtractedData, value: string) => {
    if (!extractedData) return;

    let parsedValue: number | null = null;
    if (value.trim() !== "") {
      // Clean the input value
      const cleanValue = value.replace(/[^0-9.]/g, "");
      const numValue = parseFloat(cleanValue);

      if (!isNaN(numValue)) {
        // Handle rate fields (user enters percentage like 4.5, we store as decimal 0.045)
        if (field.includes("Rate")) {
          parsedValue = numValue / 100;
        } else {
          parsedValue = numValue;
        }
      }
    }

    // Create updated data with new field value
    const updatedData = {
      ...extractedData,
      [field]: parsedValue,
    };

    // Recalculate derived values based on scenario
    if (scenario === 1) {
      // Recalculate Scenario 1 values when relevant fields change
      const relevantFields = ["mortgageAmount", "currentAmortization", "previousRate", "currentMarketRate"];
      if (relevantFields.includes(field)) {
        const mortgageAmount = updatedData.mortgageAmount || 0;
        const currentAmortization = updatedData.currentAmortization || 20;
        const previousRate = updatedData.previousRate || 0;
        const currentMarketRate = updatedData.currentMarketRate || 0;

        if (mortgageAmount > 0 && previousRate > 0 && currentMarketRate > 0) {
          const calculated = calculateScenario1Data({
            mortgageAmount,
            currentAmortization,
            previousRate,
            currentMarketRate,
          });
          updatedData.oldPayment = calculated.oldPayment;
          updatedData.newPayment = calculated.newPayment;
          updatedData.paymentDifference = calculated.paymentDifference;
          updatedData.fiveYearsOfPayments = calculated.fiveYearsOfPayments;
        }
      }
    } else if (scenario === 2) {
      // Recalculate Scenario 2 values when relevant fields change
      const relevantFields = ["mortgageAmount", "originalRate", "lockInRate"];
      if (relevantFields.includes(field)) {
        const mortgageAmount = updatedData.mortgageAmount || 0;
        const originalRate = updatedData.originalRate || 0;
        const lockInRate = updatedData.lockInRate || 0;

        if (mortgageAmount > 0 && originalRate > 0 && lockInRate > 0) {
          const calculated = calculateScenario2Data({
            mortgageAmount,
            originalRate,
            lockInRate,
          });
          updatedData.estimatedExtraInterest = calculated.estimatedExtraInterest;
        }
      }
    }

    setExtractedData(updatedData);
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

    if (scenario === null) {
      alert("Please select a scenario (or 'None' to skip)");
      return;
    }

    setIsGeneratingPDF(true);

    try {
      const clientName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Client";
      const date = new Date().toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Generate PDF using Puppeteer API endpoint
      const pdfResponse = await fetch("/api/reports/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          date,
          consultant: {
            name: selectedAdvisor.name,
            email: selectedAdvisor.email,
            phone: selectedAdvisor.phone || "",
            calLink: selectedAdvisor.calLink || "",
          },
          bullets,
          mortgageAmount: formatCurrency(extractedData?.mortgageAmount || mortgageBalance),
          scenario: scenario === 0 ? null : scenario,
          includeDebtConsolidation,
          includeCashBack,
          applicationLink: applicationUrl,
          partnerName: partnerName.trim() || null,
          extractedData: extractedData || {},
        }),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      // Get the PDF blob from the response
      const blob = await pdfResponse.blob();

      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${clientName.replace(/\s+/g, "-")}-Post-Discovery-Report.pdf`;
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
          mortgageAmount: extractedData?.mortgageAmount || mortgageBalance,
          scenario: scenario === 0 ? null : scenario,
          includeDebtConsolidation,
          includeCashBack,
          applicationLink: applicationUrl,
          partnerName: partnerName.trim() || null,
          extractedData,
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
      alert(err instanceof Error ? err.message : "Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Download a historical report
  const handleDownloadHistoricalReport = async (report: SavedReport) => {
    setDownloadingReportId(report.id);

    try {
      const clientName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Client";
      const date = new Date(report.createdAt).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Generate PDF using Puppeteer API endpoint
      const pdfResponse = await fetch("/api/reports/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          date,
          consultant: {
            name: report.consultantName,
            email: report.generatedBy.email,
            phone: report.generatedBy.phone || "",
            calLink: report.generatedBy.calLink || "",
          },
          bullets: report.bullets,
          mortgageAmount: formatCurrency(report.mortgageAmount),
          scenario: report.scenario ? (report.scenario as 0 | 1 | 2 | 3) : null,
          includeDebtConsolidation: report.includeDebtConsolidation || false,
          includeCashBack: report.includeCashBack || false,
          applicationLink: report.applicationLink || "https://stressfree.mtg-app.com/signup",
          partnerName: report.partnerName || null,
          extractedData: report.extractedData || {},
        }),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      const blob = await pdfResponse.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${clientName.replace(/\s+/g, "-")}-Post-Discovery-Report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert(err instanceof Error ? err.message : "Failed to generate PDF. Please try again.");
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

  // Get scenario label for display
  const getScenarioLabel = (scenarioNum: number) => {
    const option = SCENARIO_OPTIONS.find((o) => o.value === scenarioNum);
    return option ? `Scenario ${scenarioNum}` : `Scenario ${scenarioNum}`;
  };

  // Check for missing required data based on scenario
  const getMissingFields = (): string[] => {
    if (!extractedData || !scenario) return [];

    const missing: string[] = [];

    if (!extractedData.mortgageAmount) missing.push("Mortgage Amount");
    if (!extractedData.currentAmortization) missing.push("Current Amortization");

    if (scenario === 1) {
      if (!extractedData.previousRate) missing.push("Previous Rate");
      if (!extractedData.currentMarketRate) missing.push("Current Market Rate");
    } else if (scenario === 2) {
      if (!extractedData.originalRate) missing.push("Original Rate");
      if (!extractedData.lockInRate) missing.push("Lock-In Rate");
    } else if (scenario === 3) {
      if (!extractedData.originalRate) missing.push("Original Rate");
      if (!extractedData.fixedPayment) missing.push("Fixed Payment");
    }

    return missing;
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

            {/* Scenario Selection */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-2">
                Client Scenario <span className="text-red-500">*</span>
              </label>
              <select
                value={scenario || ""}
                onChange={(e) => setScenario(e.target.value !== "" ? (parseInt(e.target.value) as 0 | 1 | 2 | 3) : null)}
                className="w-full border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] transition-all duration-150"
              >
                <option value="">Select scenario...</option>
                {SCENARIO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {scenario !== null && (
                <p className="text-xs text-[#8E8983] mt-1">
                  {SCENARIO_OPTIONS.find((o) => o.value === scenario)?.description}
                </p>
              )}
            </div>

            {/* Debt Consolidation Checkbox */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDebtConsolidation}
                  onChange={(e) => setIncludeDebtConsolidation(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E0D8] text-[#625FFF] focus:ring-[#B1AFFF]"
                />
                <span className="text-sm text-[#1C1B1A]">
                  Include debt consolidation section
                </span>
              </label>
              <p className="text-xs text-[#8E8983] mt-1 ml-6">
                Add this when the client has mentioned other debts on the call
              </p>
            </div>

            {/* Cash Back Strategy Checkbox */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCashBack}
                  onChange={(e) => setIncludeCashBack(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E0D8] text-[#625FFF] focus:ring-[#B1AFFF]"
                />
                <span className="text-sm text-[#1C1B1A]">
                  Include Cash Back Strategy
                </span>
              </label>
              <p className="text-xs text-[#8E8983] mt-1 ml-6">
                Add when cash back mortgage could benefit the client (debt payoff, CMHC avoidance, etc.)
              </p>
            </div>

            {/* Application URL Field */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-2">
                Application URL
              </label>
              <input
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://stressfree.mtg-app.com/signup"
                className="w-full border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] transition-all duration-150"
              />
              <p className="text-xs text-[#8E8983] mt-1">
                This URL appears in 3 locations in the report (cover, steps, CTA)
              </p>
            </div>

            {/* Spouse/Partner Name Field */}
            <div>
              <label className="block text-sm font-medium text-[#1C1B1A] mb-2">
                Spouse/Partner Name <span className="text-xs text-[#8E8983] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="Leave blank to use &quot;your partner&quot;"
                className="w-full border border-[#E5E0D8] rounded-xl p-3 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF] transition-all duration-150"
              />
              <p className="text-xs text-[#8E8983] mt-1">
                Used in email/SMS personalization. Falls back to &quot;your partner&quot; if empty.
              </p>
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

            {scenario === null && notes.length >= 50 && selectedAdvisor && (
              <p className="text-xs text-amber-600">Please select a scenario to continue (or &quot;None&quot; to skip)</p>
            )}
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

            {/* Extracted Data Section */}
            {scenario !== null && scenario !== 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-[#1C1B1A] mb-3">
                  Extracted Mortgage Data
                  {isExtractingData && (
                    <span className="ml-2 text-xs text-[#8E8983] font-normal">
                      (extracting...)
                    </span>
                  )}
                </h4>

                {getMissingFields().length > 0 && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      Missing: {getMissingFields().join(", ")}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Common Fields */}
                  <div>
                    <label className="text-xs text-[#8E8983]">Mortgage Amount</label>
                    <input
                      type="number"
                      step="1000"
                      value={extractedData?.mortgageAmount || ""}
                      onChange={(e) => handleExtractedDataChange("mortgageAmount", e.target.value)}
                      placeholder="e.g., 500000"
                      className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#8E8983]">Current Amortization (years)</label>
                    <input
                      type="number"
                      step="1"
                      value={extractedData?.currentAmortization || ""}
                      onChange={(e) => handleExtractedDataChange("currentAmortization", e.target.value)}
                      placeholder="e.g., 20"
                      className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                    />
                  </div>

                  {/* Scenario 1 Fields */}
                  {scenario === 1 && (
                    <>
                      <div>
                        <label className="text-xs text-[#8E8983]">Previous Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={extractedData?.previousRate ? Math.round(extractedData.previousRate * 10000) / 100 : ""}
                          onChange={(e) => handleExtractedDataChange("previousRate", e.target.value)}
                          placeholder="e.g., 1.89"
                          className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#8E8983]">Current Market Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={extractedData?.currentMarketRate ? Math.round(extractedData.currentMarketRate * 10000) / 100 : ""}
                          onChange={(e) => handleExtractedDataChange("currentMarketRate", e.target.value)}
                          placeholder="e.g., 4.5"
                          className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                        />
                      </div>
                    </>
                  )}

                  {/* Scenario 2 Fields */}
                  {scenario === 2 && (
                    <>
                      <div>
                        <label className="text-xs text-[#8E8983]">Original Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={extractedData?.originalRate ? Math.round(extractedData.originalRate * 10000) / 100 : ""}
                          onChange={(e) => handleExtractedDataChange("originalRate", e.target.value)}
                          placeholder="e.g., 1.45"
                          className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#8E8983]">Lock-In Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={extractedData?.lockInRate ? Math.round(extractedData.lockInRate * 10000) / 100 : ""}
                          onChange={(e) => handleExtractedDataChange("lockInRate", e.target.value)}
                          placeholder="e.g., 5.79"
                          className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                        />
                      </div>
                    </>
                  )}

                  {/* Scenario 3 Fields */}
                  {scenario === 3 && (
                    <>
                      <div>
                        <label className="text-xs text-[#8E8983]">Original Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={extractedData?.originalRate ? Math.round(extractedData.originalRate * 10000) / 100 : ""}
                          onChange={(e) => handleExtractedDataChange("originalRate", e.target.value)}
                          placeholder="e.g., 1.89"
                          className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#8E8983]">Fixed Payment</label>
                        <input
                          type="number"
                          step="10"
                          value={extractedData?.fixedPayment || ""}
                          onChange={(e) => handleExtractedDataChange("fixedPayment", e.target.value)}
                          placeholder="e.g., 2500"
                          className="w-full border border-[#E5E0D8] rounded-lg px-3 py-2 text-sm text-[#1C1B1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#B1AFFF] focus:border-[#625FFF]"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Calculated Values (read-only display) */}
                {scenario === 1 && extractedData && (
                  <div className="mt-4 p-3 bg-white rounded-lg">
                    <p className="text-xs text-[#8E8983] mb-2">Calculated Values</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[#8E8983]">Old Payment:</span>{" "}
                        <span className="font-medium">{extractedData.oldPayment ? formatCurrency(extractedData.oldPayment) : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[#8E8983]">New Payment:</span>{" "}
                        <span className="font-medium">{extractedData.newPayment ? formatCurrency(extractedData.newPayment) : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[#8E8983]">Difference:</span>{" "}
                        <span className="font-medium text-red-600">{extractedData.paymentDifference ? `+${formatCurrency(extractedData.paymentDifference)}` : "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[#8E8983]">5 Years of Payments:</span>{" "}
                        <span className="font-medium">{extractedData.fiveYearsOfPayments ? formatCurrency(extractedData.fiveYearsOfPayments) : "N/A"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {scenario === 2 && extractedData && (
                  <div className="mt-4 p-3 bg-white rounded-lg">
                    <p className="text-xs text-[#8E8983] mb-2">Calculated Values</p>
                    <div className="text-sm">
                      <span className="text-[#8E8983]">Estimated Extra Interest:</span>{" "}
                      <span className="font-medium text-red-600">{extractedData.estimatedExtraInterest ? formatCurrency(extractedData.estimatedExtraInterest) : "N/A"}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                disabled={isGeneratingPDF || bullets.length === 0 || scenario === null}
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
                {sendingReportId && sendingReportId === currentReportId ? "Sending..." : "Send to Client"}
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
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[#8E8983]">
                          by {report.consultantName}
                        </span>
                        <span className="text-xs text-[#8E8983]">•</span>
                        <span className="text-xs text-[#625FFF] font-medium">
                          {getScenarioLabel(report.scenario)}
                        </span>
                        <span className="text-xs text-[#8E8983]">•</span>
                        <span className="text-xs text-[#8E8983]">
                          {formatCurrency(report.mortgageAmount)}
                        </span>
                        {report.includeDebtConsolidation && (
                          <>
                            <span className="text-xs text-[#8E8983]">•</span>
                            <span className="text-xs text-amber-600">+ Debt Consol.</span>
                          </>
                        )}
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
