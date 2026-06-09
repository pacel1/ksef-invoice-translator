import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "onDark";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[11px] font-dm font-semibold transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-brand hover:bg-brand-hover",
  ghost: "bg-paper text-ink border border-line hover:bg-paper-soft",
  onDark: "bg-white text-ink hover:bg-paper-soft focus-visible:ring-offset-ink"
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[14px]",
  lg: "h-[52px] px-6 text-[15px]"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
}

export function Button({ variant = "primary", size = "md", href, type, className, children, ...props }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if (href) {
    return (
      <a href={href} className={classes} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button type={type ?? "button"} className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
