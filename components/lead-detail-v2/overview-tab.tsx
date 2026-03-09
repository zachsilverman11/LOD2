"use client";

import { useState } from "react";
import { LeadWithRelations } from "@/types/lead";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { format } from "date-fns";

type OverviewTabProps = {
  lead: LeadWithRelations;
  onRefresh: () => void;
  onLogCallOutcome?: (appointmentId?: string) => void;
};

// Format phone number for display
function formatPhone(phone: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// Format currency as Canadian dollars
function formatCurrency(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(num);
}

// Format source names
function formatSource(source: string | null): string {
  if (!source) return "—";
  const sourceMap: Record<string, string> = {
    leads_on_demand: "Leads On Demand",
    facebook: "Facebook",
    google: "Google Ads",
    referral: "Referral",
    organic: "Organic Search",
    direct: "Direct",
  };
  return (
    sourceMap[source.toLowerCase()] ||
    source
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

// Parse date from rawData (handles DD/MM/YYYY format from Leads on Demand)
function parseRawDate(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value);
  const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/;
  const match = str.match(ddmmyyyyPattern);
  if (match) {
    const [, day, month, year, time] = match;
    const dateStr = `${month}/${day}/${year} ${time}`;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
  }
  const date = new Date(str);
  if (!isNaN(date.getTime())) return date;
  return null;
}

// Format field name from camelCase/snake_case to readable label
function formatFieldName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Check if a value looks like a currency amount
function isCurrencyField(key: string): boolean {
  const currencyKeywords = [
    "value", "amount", "price", "balance", "payment", "income", "salary",
    "equity", "down", "cost", "fee", "rate", "mortgage", "loan"
  ];
  const lowerKey = key.toLowerCase();
  return currencyKeywords.some((kw) => lowerKey.includes(kw));
}

// Check if a value looks like a date/time field
function isDateField(key: string): boolean {
  const dateKeywords = ["date", "time", "at", "created", "updated", "submitted"];
  const lowerKey = key.toLowerCase();
  return dateKeywords.some((kw) => lowerKey.includes(kw));
}

// Format field value based on field name and value type
function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  const strValue = String(value);

  // Try to format as currency if key suggests it's a money field
  if (isCurrencyField(key)) {
    const num = parseFloat(strValue.replace(/[^0-9.-]/g, ""));
    if (!isNaN(num) && num > 100) {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(num);
    }
  }

  // Try to format as date if key suggests it's a date field
  if (isDateField(key)) {
    const date = parseRawDate(value);
    if (date) {
      return format(date, "MMM d, yyyy");
    }
  }

  // Handle boolean values
  if (value === true || strValue.toLowerCase() === "true" || strValue.toLowerCase() === "yes") {
    return "Yes";
  }
  if (value === false || strValue.toLowerCase() === "false" || strValue.toLowerCase() === "no") {
    return "No";
  }

  return strValue;
}

// Copy to clipboard helper
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-[#8E8983] hover:text-[#625FFF] hover:bg-[#625FFF]/5 rounded-md transition-all duration-150"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-4 h-4 text-[#76C63E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

// Field row component for consistent styling
function FieldRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#8E8983]">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-[#1C1B1A]">{value}</span>
        {copyable && value !== "—" && <CopyButton text={value} />}
      </div>
    </div>
  );
}

export function OverviewTab({ lead, onRefresh, onLogCallOutcome }: OverviewTabProps) {
  const [isTogglingHolly, setIsTogglingHolly] = useState(false);
  const [isTogglingBookingSource, setIsTogglingBookingSource] = useState(false);

  // Extract lead details from rawData
  const rawData = (lead.rawData as Record<string, unknown>) || {};

  // Get specific fields from rawData
  const city = rawData.city || rawData.City || "—";
  const province = rawData.province || rawData.Province || rawData.state || rawData.State || "—";
  const lender = rawData.lender || rawData.Lender || rawData.current_lender || "—";
  const loanType = rawData.lead_type || rawData.loan_type || rawData.loanType || rawData.LoanType || "—";
  const propertyType = rawData.prop_type || rawData.property_type || rawData.propertyType || rawData.PropertyType || "—";
  const balance = rawData.balance || rawData.Balance || rawData.mortgage_balance || rawData.loanAmount || null;
  const homeValue = rawData.home_value || rawData.homeValue || rawData.HomeValue || rawData.propertyValue || null;
  const hasRentIncome = rawData.rent_check || rawData.rentCheck || rawData.hasRentIncome || null;
  const captureTime = rawData.capture_time || rawData.captureTime || rawData.submitted_at || lead.createdAt;

  // Parse submitted date
  const submittedDate = parseRawDate(captureTime) || new Date(lead.createdAt);

  // Get upcoming appointment (first scheduled one)
  const upcomingAppointment = lead.appointments?.find(
    (appt) => appt.status === "scheduled" || appt.status === "completed"
  );

  // Toggle Holly status
  const handleToggleHolly = async () => {
    setIsTogglingHolly(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hollyDisabled: !lead.hollyDisabled }),
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error toggling Holly:", error);
    } finally {
      setIsTogglingHolly(false);
    }
  };

  // Check if appointment should show no-show button
  const shouldShowNoShow = (appt: typeof upcomingAppointment) => {
    if (!appt || appt.status !== "completed") return false;
    const appointmentTime = new Date(appt.scheduledAt);
    const now = new Date();
    const hoursSince = (now.getTime() - appointmentTime.getTime()) / (1000 * 60 * 60);
    return hoursSince >= 0 && hoursSince <= 24;
  };

  // Handle mark as no-show
  const handleMarkNoShow = async (appointmentId: string) => {
    if (!confirm("Mark this appointment as no-show? This will move the lead back to ENGAGED and trigger a recovery message.")) {
      return;
    }
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/mark-no-show`, {
        method: "POST",
      });
      if (response.ok) {
        onRefresh();
      } else {
        alert("Failed to mark as no-show");
      }
    } catch (error) {
      console.error("Error marking as no-show:", error);
      alert("Error marking as no-show");
    }
  };

  // Handle toggle booking source
  const handleToggleBookingSource = async (appointmentId: string, currentSource: string | null) => {
    setIsTogglingBookingSource(true);
    const newSource = currentSource === "MANUAL" ? "HOLLY" : "MANUAL";
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/booking-source`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingSource: newSource, markedBy: "Adviser" }),
      });
      if (response.ok) {
        onRefresh();
      } else {
        alert("Failed to update booking source");
      }
    } catch (error) {
      console.error("Error updating booking source:", error);
      alert("Error updating booking source");
    } finally {
      setIsTogglingBookingSource(false);
    }
  };

  // Get booking source label and styling
  const getBookingSourceDisplay = (source: string | null) => {
    switch (source) {
      case "MANUAL":
        return { label: "Manual", variant: "purple" as const };
      case "LOD":
        return { label: "System", variant: "info" as const };
      case "HOLLY":
      default:
        return { label: "Holly", variant: "neutral" as const };
    }
  };

  const isHollyActive = !lead.hollyDisabled;

  return (
    <div className="p-4 space-y-4 sm:p-5">
      {/* Contact Information */}
      <section>
        <SectionLabel>Contact Information</SectionLabel>
        <Card>
          <CardContent className="divide-y divide-[#E5E0D8]/50">
            <FieldRow label="Email" value={lead.email || "—"} copyable />
            <FieldRow label="Phone" value={formatPhone(lead.phone)} copyable />
            <FieldRow label="Source" value={formatSource(lead.source)} />
          </CardContent>
        </Card>
      </section>

      {/* Lead Details */}
      <section>
        <SectionLabel>Lead Details</SectionLabel>
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Location</p>
                <p className="text-sm font-medium text-[#1C1B1A]">
                  {city !== "—" || province !== "—" ? `${city}, ${province}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Lender</p>
                <p className="text-sm font-medium text-[#1C1B1A]">{String(lender)}</p>
              </div>
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Loan Type</p>
                <p className="text-sm font-medium text-[#1C1B1A]">{String(loanType)}</p>
              </div>
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Property Type</p>
                <p className="text-sm font-medium text-[#1C1B1A]">{String(propertyType)}</p>
              </div>
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Balance</p>
                <p className="text-sm font-medium text-[#1C1B1A]">{formatCurrency(balance)}</p>
              </div>
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Home Value</p>
                <p className="text-sm font-medium text-[#1C1B1A]">{formatCurrency(homeValue)}</p>
              </div>
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Has Rent Income</p>
                <p className="text-sm font-medium text-[#1C1B1A]">
                  {hasRentIncome === "Yes" || hasRentIncome === true
                    ? "Yes"
                    : hasRentIncome === "No" || hasRentIncome === false
                    ? "No"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#8E8983] mb-0.5">Submitted</p>
                <p className="text-sm font-medium text-[#1C1B1A]">
                  {format(submittedDate, "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Application Status - show if lead has application tracking data */}
      {(lead.applicationStartedAt || lead.applicationCompletedAt) && (
        <section>
          <SectionLabel>Application Status</SectionLabel>
          <Card>
            <CardContent>
              <div className="space-y-3">
                {lead.applicationStartedAt && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                      <span className="text-sm text-[#8E8983]">Application Started</span>
                    </div>
                    <span className="text-sm font-medium text-[#1C1B1A]">
                      {format(new Date(lead.applicationStartedAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                )}
                {lead.applicationCompletedAt ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#76C63E]" />
                      <span className="text-sm text-[#8E8983]">Application Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#1C1B1A]">
                        {format(new Date(lead.applicationCompletedAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <Badge variant="success">CONVERTED</Badge>
                    </div>
                  </div>
                ) : lead.applicationStartedAt ? (
                  <div className="flex items-center gap-2 text-sm text-[#8E8983]">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Application in progress</span>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Additional Details - dynamically display all other rawData fields */}
      {(() => {
        // Fields already displayed elsewhere or should be hidden
        const excludedFields = new Set([
          // Already displayed in Lead Details
          "city", "City", "province", "Province", "state", "State",
          "lender", "Lender", "current_lender",
          "lead_type", "loan_type", "loanType", "LoanType",
          "prop_type", "property_type", "propertyType", "PropertyType",
          "balance", "Balance", "mortgage_balance",
          "home_value", "homeValue", "HomeValue", "propertyValue",
          "rent_check", "rentCheck", "hasRentIncome",
          "capture_time", "captureTime", "submitted_at",
          // Contact info displayed elsewhere
          "name", "Name", "first_name", "last_name", "firstName", "lastName",
          "email", "Email", "phone", "Phone", "mobile", "Mobile",
          // Consent fields
          "consent", "consent_email", "consent_sms", "consent_call",
          "consentEmail", "consentSms", "consentCall",
          // Internal/tracking fields
          "id", "leadId", "lead_id", "webhook_id", "webhookId",
          "source", "Source", "utm_source", "utm_medium", "utm_campaign",
        ]);

        const additionalFields = Object.entries(rawData)
          .filter(([key, value]) => {
            // Exclude known fields
            if (excludedFields.has(key)) return false;
            // Exclude empty values
            if (value === null || value === undefined || value === "") return false;
            // Exclude objects and arrays
            if (typeof value === "object") return false;
            return true;
          })
          .sort(([a], [b]) => a.localeCompare(b));

        if (additionalFields.length === 0) return null;

        return (
          <section>
            <SectionLabel>Additional Details</SectionLabel>
            <Card>
              <CardContent>
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {additionalFields.map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm text-[#8E8983] mb-0.5">{formatFieldName(key)}</p>
                      <p className="text-sm font-medium text-[#1C1B1A]">{formatFieldValue(key, value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        );
      })()}

      {/* Consent Status */}
      <section>
        <SectionLabel>Consent Status</SectionLabel>
        <Card>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant={lead.consentEmail ? "success" : "neutral"}>
                {lead.consentEmail && (
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Email
              </Badge>
              <Badge variant={lead.consentSms ? "success" : "neutral"}>
                {lead.consentSms && (
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                SMS
              </Badge>
              <Badge variant={lead.consentCall ? "success" : "neutral"}>
                {lead.consentCall && (
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Call
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Holly AI */}
      <section>
        <SectionLabel>Holly AI Assistant</SectionLabel>
        <Card>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isHollyActive ? "bg-[#76C63E]/10" : "bg-[#FBF3E7]"}`}>
                  <div className={`w-3 h-3 rounded-full ${isHollyActive ? "bg-[#76C63E]" : "bg-[#8E8983]"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1C1B1A]">
                    {isHollyActive ? "Active" : "Disabled"}
                  </p>
                  <p className="text-xs text-[#8E8983]">
                    {isHollyActive
                      ? "Automated follow-ups enabled"
                      : "No automated messages"}
                  </p>
                </div>
              </div>
              <Button
                variant={isHollyActive ? "danger" : "primary"}
                size="sm"
                onClick={handleToggleHolly}
                disabled={isTogglingHolly}
              >
                {isTogglingHolly ? "..." : isHollyActive ? "Disable" : "Enable"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Upcoming Appointment */}
      {upcomingAppointment && (
        <section>
          <SectionLabel>Upcoming Appointment</SectionLabel>
          <Card>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1C1B1A]">
                    {format(new Date(upcomingAppointment.scheduledAt), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm text-[#8E8983] mt-0.5">
                    {format(new Date(upcomingAppointment.scheduledAt), "h:mm a")} · {upcomingAppointment.duration} min
                  </p>
                  {upcomingAppointment.advisorName && (
                    <p className="text-xs text-[#8E8983] mt-1">
                      with <span className="font-medium text-[#1C1B1A]">{upcomingAppointment.advisorName}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getBookingSourceDisplay(upcomingAppointment.bookingSource).variant}>
                    {getBookingSourceDisplay(upcomingAppointment.bookingSource).label}
                  </Badge>
                  <Badge
                    variant={
                      upcomingAppointment.status === "scheduled"
                        ? "warning"
                        : upcomingAppointment.status === "completed"
                        ? "info"
                        : "neutral"
                    }
                  >
                    {upcomingAppointment.status === "no_show" ? "No Show" : upcomingAppointment.status}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-[#E5E0D8]/50 sm:flex-row sm:flex-wrap">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onLogCallOutcome?.(upcomingAppointment.id)}
                  className="w-full sm:w-auto"
                >
                  Log Call Outcome
                </Button>

                <Button
                  size="sm"
                  variant={upcomingAppointment.bookingSource === "MANUAL" ? "secondary" : "secondary"}
                  onClick={() => handleToggleBookingSource(upcomingAppointment.id, upcomingAppointment.bookingSource)}
                  disabled={isTogglingBookingSource}
                  className={`w-full sm:w-auto ${upcomingAppointment.bookingSource === "MANUAL" ? "border-[#625FFF] text-[#625FFF]" : ""}`}
                >
                  {isTogglingBookingSource ? "..." : upcomingAppointment.bookingSource === "MANUAL" ? "Unmark Manual" : "Mark as Manual"}
                </Button>

                {shouldShowNoShow(upcomingAppointment) && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleMarkNoShow(upcomingAppointment.id)}
                    className="w-full sm:w-auto"
                  >
                    Mark as No-Show
                  </Button>
                )}

                {upcomingAppointment.meetingUrl && (
                  <a
                    href={upcomingAppointment.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#625FFF] hover:bg-[#625FFF]/5 transition-all duration-150 sm:min-h-0 sm:justify-start"
                  >
                    Join Meeting
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* All Appointments (if more than the upcoming one) */}
      {lead.appointments && lead.appointments.length > 1 && (
        <section>
          <SectionLabel>All Appointments ({lead.appointments.length})</SectionLabel>
          <Card>
            <CardContent className="divide-y divide-[#E5E0D8]/50">
              {lead.appointments
                .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                .map((appt) => (
                  <div
                    key={appt.id}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1C1B1A]">
                        {format(new Date(appt.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      {appt.advisorName && (
                        <p className="text-xs text-[#8E8983]">with {appt.advisorName}</p>
                      )}
                    </div>
                    <Badge
                      variant={
                        appt.status === "scheduled"
                          ? "warning"
                          : appt.status === "completed"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {appt.status === "no_show" ? "No Show" : appt.status}
                    </Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
