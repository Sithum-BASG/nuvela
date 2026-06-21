import { AlertCircle, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ErrorCalloutVariant = "forbidden" | "not-found" | "network" | "notice";

const VARIANT_META: Record<
  ErrorCalloutVariant,
  { icon: LucideIcon; title: string; description: string }
> = {
  forbidden: {
    icon: ShieldAlert,
    title: "You don't have permission",
    description: "This action isn't available for your role. Contact your administrator if you need access.",
  },
  "not-found": {
    icon: AlertCircle,
    title: "Not found",
    description: "This item may have been removed or you don't have access to it.",
  },
  network: {
    icon: WifiOff,
    title: "Couldn't load",
    description: "Check your connection and try again.",
  },
  notice: {
    icon: AlertCircle,
    title: "Session expired",
    description: "Please log in again to continue.",
  },
};

type Props = {
  variant: ErrorCalloutVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorCallout({
  variant,
  title,
  description,
  onRetry,
  className,
}: Props) {
  const meta = VARIANT_META[variant];
  const Icon = meta.icon;
  const isDestructive = variant === "forbidden" || variant === "network";

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-card border px-4 py-3.5",
        isDestructive
          ? "border-destructive/25 bg-destructive/5"
          : "border-border bg-muted/50",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-control",
          isDestructive ? "bg-destructive/10 text-destructive" : "bg-muted text-text-secondary",
        )}
        aria-hidden
      >
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title ?? meta.title}</p>
        <p className="text-[13px] leading-5 text-text-secondary">
          {description ?? meta.description}
        </p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-fit gap-1.5"
            onClick={onRetry}
          >
            <RefreshCw className="size-3.5" strokeWidth={2} aria-hidden />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
