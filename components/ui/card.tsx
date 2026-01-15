import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  hover?: boolean;
};

export function Card({ children, className = "", hover = false }: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-xl border border-[#E5E0D8] shadow-sm
        ${hover ? "hover:shadow-md hover:border-[#B1AFFF]/50 transition-all duration-200" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  children: ReactNode;
  className?: string;
};

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`px-5 py-4 border-b border-[#E5E0D8]/50 ${className}`}>
      {children}
    </div>
  );
}

type CardContentProps = {
  children: ReactNode;
  className?: string;
};

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

type CardFooterProps = {
  children: ReactNode;
  className?: string;
};

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`px-5 py-4 border-t border-[#E5E0D8]/50 ${className}`}>
      {children}
    </div>
  );
}
