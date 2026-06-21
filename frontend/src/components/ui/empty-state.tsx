import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** default = card; compact = in-column/panel; minimal = quiet inline placeholder */
  size?: "default" | "compact" | "minimal";
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "default",
}: EmptyStateProps) {
  if (size === "minimal") {
    return (
      <p className={cn("py-4 text-center text-[12px] text-text-muted", className)} role="status">
        {title}
      </p>
    );
  }

  if (size === "compact") {
    return (
      <div
        className={cn("flex flex-col items-center gap-2 px-3 py-5 text-center", className)}
        role="status"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-tint text-primary">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-[220px] text-[12px] leading-4 text-text-muted">{description}</p>
        ) : null}
        {action}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-card border border-border bg-card px-8 py-12 text-center",
        className,
      )}
      role="status"
    >
      <span className="flex size-14 items-center justify-center rounded-[28px] bg-accent-tint text-primary">
        <Icon className="size-[26px]" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1.5">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-sm leading-5 text-text-secondary">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
