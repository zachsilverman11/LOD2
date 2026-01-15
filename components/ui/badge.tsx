import { ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "info" | "neutral" | "purple" | "pink";

type BadgeProps = {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
};

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-[#76C63E]/10 text-[#2E7D32] border border-[#76C63E]/30",
  warning: "bg-[#D9F36E]/30 text-[#55514D] border border-[#D9F36E]",
  info: "bg-[#625FFF]/10 text-[#625FFF] border border-[#625FFF]/30",
  neutral: "bg-[#FBF3E7] text-[#55514D] border border-[#E5E0D8]",
  purple: "bg-[#8B88FF]/10 text-[#625FFF] border border-[#8B88FF]/30",
  pink: "bg-[#FFB6E1]/15 text-[#B3477A] border border-[#FFB6E1]/40",
};

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-xs font-medium rounded-md
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// Pre-built status badge that maps pipeline stages to variants
type StatusBadgeProps = {
  status: string;
  className?: string;
};

const statusToVariant: Record<string, BadgeVariant> = {
  NEW: "purple",
  CONTACTED: "purple",
  ENGAGED: "pink",
  CALL_SCHEDULED: "warning",
  WAITING_FOR_APPLICATION: "warning",
  APPLICATION_STARTED: "success",
  CONVERTED: "success",
  DEALS_WON: "success",
  NURTURING: "info",
  LOST: "neutral",
};

const statusLabels: Record<string, string> = {
  NEW: "New Lead",
  CONTACTED: "Contacted",
  ENGAGED: "Engaged",
  CALL_SCHEDULED: "Call Scheduled",
  WAITING_FOR_APPLICATION: "Waiting for App",
  APPLICATION_STARTED: "App Started",
  CONVERTED: "Converted",
  DEALS_WON: "Deals Won",
  NURTURING: "Nurturing",
  LOST: "Lost",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const variant = statusToVariant[status] || "neutral";
  const label = statusLabels[status] || status;

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
