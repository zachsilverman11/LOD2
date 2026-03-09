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
    bg-white dark:bg-gray-800 text-[#1C1B1A] dark:text-gray-100 border border-[#E5E0D8] dark:border-gray-600 shadow-sm
    hover:bg-[#FBF3E7] dark:hover:bg-gray-700 hover:border-[#E5E0D8] dark:hover:border-gray-500
    active:bg-[#F5EDE0] dark:active:bg-gray-600
    disabled:bg-white/50 dark:disabled:bg-gray-800/50 disabled:text-[#1C1B1A]/50 dark:disabled:text-gray-100/50 disabled:shadow-none
  `,
  ghost: `
    bg-transparent text-[#55514D] dark:text-gray-400
    hover:bg-[#FBF3E7] dark:hover:bg-gray-800 hover:text-[#1C1B1A] dark:hover:text-gray-100
    active:bg-[#F5EDE0] dark:active:bg-gray-700
    disabled:text-[#55514D]/50 dark:disabled:text-gray-400/50
  `,
  danger: `
    bg-red-50 dark:bg-red-900/20 text-[#DC2626] dark:text-red-400 border border-red-200 dark:border-red-800
    hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700
    active:bg-red-200 dark:active:bg-red-900/40
    disabled:bg-red-50/50 dark:disabled:bg-red-900/10 disabled:text-[#DC2626]/50 dark:disabled:text-red-400/50
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
          min-h-11 font-medium rounded-lg sm:min-h-0
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
