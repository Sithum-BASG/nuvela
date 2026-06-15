import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Nuvela logo mark — the rounded violet tile with the crescent + "N" stroke.
// Sourced from Figma Foundations (file Ff1qt7PSxze0Y5I49xfy70, node 41:3).
// Colors are baked in (not CSS vars) so it renders identically in light/dark.
export function LogoSymbol({
  className,
  ...props
}: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="Nuvela"
      className={cn("size-12", className)}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#nuvela_clip)">
        <rect width="40" height="40" rx="13" fill="#7C74D6" />
        <path
          d="M26.4 0C17 11.8 17 28.2 26.4 40H40.5V0H26.4Z"
          fill="#5A52B5"
        />
        <path
          d="M12 28V12L28 28V12"
          stroke="white"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="nuvela_clip">
          <rect width="40" height="40" rx="13" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

// Stacked lockup (mark + wordmark) used on the Splash screen.
export function LogoLockup({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      {...props}
    >
      <LogoSymbol className="size-11" />
      <p className="font-display text-[22px] font-semibold tracking-[-0.03em] text-foreground">
        <span className="text-primary">N</span>uvela
      </p>
    </div>
  );
}
