import * as React from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 font-dm text-[12px] font-semibold text-brand",
        className
      )}
    >
      {children}
    </span>
  );
}

export default Eyebrow;
