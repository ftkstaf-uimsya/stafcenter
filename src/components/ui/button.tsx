import React from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1E3A5F] text-white hover:bg-[#152943] dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400 border border-transparent font-medium",
  secondary:
    "bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 border border-transparent font-medium",
  outline:
    "bg-white text-slate-900 border border-slate-400 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-800 font-medium",
  danger:
    "bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:text-white dark:hover:bg-red-500 border border-transparent font-medium",
  ghost:
    "bg-transparent text-slate-800 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-800 border border-transparent font-medium",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[44px] px-3 py-2 text-xs rounded-md",
  md: "min-h-[44px] px-4 py-2.5 text-sm rounded-md",
  lg: "min-h-[48px] px-5 py-3 text-base rounded-md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className = "", variant = "primary", size = "md", children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] dark:focus-visible:ring-sky-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
