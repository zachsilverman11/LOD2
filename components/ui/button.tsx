import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[#625FFF] text-white shadow-sm
    hover:bg-[#514EE0] hover:shadow-md
    active:bg-[#4643C7]
    disabled:bg-[#625FFF]/50 disabled:shadow-none
  `,
  secondary: `
    bg-white text-[#1C1B1A] border border-[#E5E0D8] shadow-sm
    hover:bg-[#FBF3E7] hover:border-[#E5E0D8]
    active:bg-[#F5EDE0]
    disabled:bg-white/50 disabled:text-[#1C1B1A]/50 disabled:shadow-none
  `,
  ghost: `
    bg-transparent text-[#55514D]
    hover:bg-[#FBF3E7] hover:text-[#1C1B1A]
    active:bg-[#F5EDE0]
    disabled:text-[#55514D]/50
  `,
  danger: `
    bg-red-50 text-[#DC2626] border border-red-200
    hover:bg-red-100 hover:border-red-300
    active:bg-red-200
    disabled:bg-red-50/50 disabled:text-[#DC2626]/50
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center
          font-medium rounded-lg
          transition-all duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B1AFFF] focus-visible:ring-offset-2
          disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
