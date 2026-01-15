import { ReactNode } from "react";

type SectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <h3
      className={`
        text-xs font-medium uppercase tracking-wider text-[#8E8983]
        mb-3
        ${className}
      `}
    >
      {children}
    </h3>
  );
}
