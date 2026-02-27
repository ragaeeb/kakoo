"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  showValue?: boolean;
  valueFormatter?: (v: number) => string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, showValue = true, valueFormatter, ...props }, ref) => {
    const val = props.value ?? props.defaultValue ?? 0;
    const displayVal = valueFormatter ? valueFormatter(Number(val)) : String(val);

    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {(label || showValue) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {label && <span>{label}</span>}
            {showValue && <span className="font-mono tabular-nums">{displayVal}</span>}
          </div>
        )}
        <input
          type="range"
          ref={ref}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
          {...props}
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";

export { Slider };
